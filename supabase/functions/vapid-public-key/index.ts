// Lämnar ut den publika VAPID-nyckeln som appen behöver för att prenumerera på notiser.
import { corsHeaders, json } from '../_shared/supabase.ts'

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const key = Deno.env.get('VAPID_PUBLIC_KEY')
  if (!key) return json({ error: 'not_configured' }, 500)
  return json({ publicKey: key })
})
