# Inställningar i Supabase och GitHub

## GitHub-hemligheter (Settings → Secrets and variables → Actions → New repository secret)

| Namn | Var du hittar värdet |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → klicka på din profil → **Account preferences → Access Tokens → Generate new token** |
| `SUPABASE_DB_PASSWORD` | Databaslösenordet du valde när projektet skapades (kan återställas under **Project Settings → Database**) |

Används av arbetsflödet *Uppdatera Supabase* som kör databasmigreringar automatiskt.

## Inloggningsinställningar och mejlmallar (sköts automatiskt)

Arbetsflödet *Uppdatera Supabase* sätter Site URL, Redirect URLs och mejlmallarna
(*Magic link* och *Confirm signup*) via `scripts/supabase-auth-config.sh`.
Mallen finns i `supabase/templates/login-code.html`. Ändra inte mallarna i Supabase direkt,
de skrivs över vid nästa körning.

## E-postutskick (SMTP)

Supabases inbyggda e-post skickar bara till medlemmar i Supabase-projektets team och bara ett fåtal mejl i timmen.
Det räcker för att testa själv. Innan andra familjemedlemmar bjuds in (steg 4) behöver en egen SMTP-tjänst kopplas in
under **Authentication → Emails → SMTP Settings**.
