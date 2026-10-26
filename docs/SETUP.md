# Inställningar i Supabase och GitHub

## GitHub-hemligheter (Settings → Secrets and variables → Actions → New repository secret)

| Namn | Var du hittar värdet |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → klicka på din profil → **Account preferences → Access Tokens → Generate new token** |
| `SUPABASE_DB_PASSWORD` | Databaslösenordet du valde när projektet skapades (kan återställas under **Project Settings → Database**) |

Används av arbetsflödet *Uppdatera Supabase* som kör databasmigreringar automatiskt.

## Supabase: Authentication → URL Configuration

- **Site URL:** `https://sakselson-a11y.github.io/hundappen/`
- **Redirect URLs:** lägg till `https://sakselson-a11y.github.io/hundappen/**` och `http://localhost:5173/hundappen/**`

## Supabase: Authentication → Emails (mallar)

Ändra **både** *Magic link* och *Confirm signup* så att koden syns i mejlet.

**Ämne:** `Din kod till Hundappen`

**Innehåll:**

```html
<h2>Din kod till Hundappen</h2>
<p>Skriv in den här koden i appen:</p>
<p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Koden gäller i en timme. Har du inte bett om den kan du strunta i det här mejlet.</p>
<p style="color:#666;font-size:13px">Använder du Hundappen i webbläsaren kan du i stället <a href="{{ .ConfirmationURL }}">logga in med den här länken</a>.</p>
```

## E-postutskick (SMTP)

Supabases inbyggda e-post skickar bara till medlemmar i Supabase-projektets team och bara ett fåtal mejl i timmen.
Det räcker för att testa själv. Innan andra familjemedlemmar bjuds in (steg 4) behöver en egen SMTP-tjänst kopplas in
under **Authentication → Emails → SMTP Settings**.
