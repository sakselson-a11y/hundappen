import { supabase } from './supabase.ts'

export type AccountAction = 'leave' | 'delete'

// Lämna hushållet eller ta bort kontot (Edge Function account).
// Returnerar felkod, t.ex. 'owner_must_transfer', eller null om det gick bra.
export async function accountAction(action: AccountAction): Promise<string | null> {
  const { error } = await supabase.functions.invoke('account', { body: { action } })
  if (!error) return null
  try {
    const body = await (error as { context?: Response }).context?.json()
    return body?.error ?? 'generic'
  } catch {
    return 'generic'
  }
}
