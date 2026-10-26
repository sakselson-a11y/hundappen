#!/usr/bin/env bash
# Sätter inloggningsinställningar (adresser och mejlmallar) i Supabase via Management API.
# Kräver SUPABASE_ACCESS_TOKEN och SUPABASE_PROJECT_REF.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_URL="https://sakselson-a11y.github.io/hundappen/"
REDIRECTS="https://sakselson-a11y.github.io/hundappen/**,http://localhost:5173/hundappen/**"
SUBJECT="Din kod till Hundappen"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth"

body=$(python3 - "$SITE_URL" "$REDIRECTS" "$SUBJECT" <<'PY'
import json, sys
site, redirects, subject = sys.argv[1:4]
template = open('supabase/templates/login-code.html', encoding='utf-8').read()
print(json.dumps({
    'site_url': site,
    'uri_allow_list': redirects,
    'mailer_subjects_magic_link': subject,
    'mailer_templates_magic_link_content': template,
    'mailer_subjects_confirmation': subject,
    'mailer_templates_confirmation_content': template,
}))
PY
)

# Anropar API:t och visar Supabases felmeddelande om något går fel.
call() {
  local out status
  out=$(mktemp)
  status=$(curl -sS -o "$out" -w '%{http_code}' -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$@")
  if [ "$status" -ge 400 ]; then
    echo "::error::Supabase svarade $status: $(head -c 500 "$out" | tr '\n' ' ')" >&2
    exit 1
  fi
  cat "$out"
}

call -X PATCH "$API" -H "Content-Type: application/json" -d "$body" > /dev/null

# Kontrollera att inställningarna faktiskt sparades.
call "$API" | python3 -c '
import json, sys
c = json.load(sys.stdin)
ok = True
for key in ("mailer_templates_magic_link_content", "mailer_templates_confirmation_content"):
    if "{{ .Token }}" not in (c.get(key) or ""):
        print(f"::error::{key} saknar koden {{{{ .Token }}}}"); ok = False
if c.get("site_url") != sys.argv[1]:
    print(f"::error::site_url är {c.get(\"site_url\")}"); ok = False
print("Inloggningsinställningar uppdaterade." if ok else "Något sparades inte.")
sys.exit(0 if ok else 1)
' "$SITE_URL"
