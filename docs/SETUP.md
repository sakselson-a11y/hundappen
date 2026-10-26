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

## E-postutskick (SMTP via Gmail)

Krävs för att mejlmallen med kod ska kunna sparas och för att mejl ska nå andra än projektets team.

1. Google-kontot måste ha tvåstegsverifiering. Skapa ett applösenord på https://myaccount.google.com/apppasswords.
2. Supabase → **Authentication → Emails → SMTP Settings** → *Enable custom SMTP*:

| Fält | Värde |
|---|---|
| Sender email | Gmail-adressen |
| Sender name | `Hundappen` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | Gmail-adressen |
| Password | applösenordet (16 tecken, utan mellanslag) |

3. Kör arbetsflödet *Uppdatera Supabase* (Actions → Run workflow) så att mejlmallen med kod sparas.

Byte till Resend eller annan tjänst med egen domän görs på samma ställe; inget i appen behöver ändras.
