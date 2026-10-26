// Lämna hushållet eller ta bort sitt konto. Körs på servern eftersom foton i Storage
// och själva inloggningskontot bara kan tas bort med full åtkomst.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { adminClient, corsHeaders, json, requireUser } from '../_shared/supabase.ts'

const BUCKET = 'dog-photos'

// Tar bort alla foton under <household_id>/ (hundfoton och loggfoton).
async function deletePhotos(admin: SupabaseClient, householdId: string): Promise<void> {
  const paths: string[] = []
  const walk = async (prefix: string) => {
    const { data } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 })
    for (const entry of data ?? []) {
      const path = `${prefix}/${entry.name}`
      // Mappar saknar id i listningen.
      if (entry.id) paths.push(path)
      else await walk(path)
    }
  }
  await walk(householdId)
  for (let i = 0; i < paths.length; i += 100) {
    await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100))
  }
}

async function deleteHousehold(admin: SupabaseClient, householdId: string): Promise<void> {
  await deletePhotos(admin, householdId)
  // Hund, loggar, schema, medlemmar och inbjudningar tas bort via "on delete cascade".
  await admin.from('households').delete().eq('id', householdId)
}

type Result = { ok: true } | { error: string; status: number }

async function leave(admin: SupabaseClient, userId: string, autoTransfer: boolean): Promise<Result> {
  const { data: me } = await admin
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (!me) return { ok: true }

  if (me.role === 'owner') {
    const { data: others } = await admin
      .from('household_members')
      .select('user_id')
      .eq('household_id', me.household_id)
      .neq('user_id', userId)
      .order('joined_at')
    if (!others?.length) {
      await deleteHousehold(admin, me.household_id)
      return { ok: true }
    }
    if (!autoTransfer) return { error: 'owner_must_transfer', status: 409 }
    // Kontot tas bort: den som gick med först blir ny ägare så att familjens data finns kvar.
    await admin
      .from('household_members')
      .update({ role: 'owner' })
      .eq('household_id', me.household_id)
      .eq('user_id', others[0].user_id)
  }

  await admin.from('household_members').delete().eq('household_id', me.household_id).eq('user_id', userId)
  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()
  const user = await requireUser(req, admin)
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { action } = await req.json().catch(() => ({}))
  if (action !== 'leave' && action !== 'delete') return json({ error: 'okänd åtgärd' }, 400)

  const result = await leave(admin, user.id, action === 'delete')
  if ('error' in result) return json({ error: result.error }, result.status)

  if (action === 'delete') {
    // Profil, notisenheter och medlemskap försvinner med kontot; loggar blir "Tidigare medlem".
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('deleteUser', error)
      return json({ error: 'delete_failed' }, 500)
    }
  }
  return json({ ok: true })
})
