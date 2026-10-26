#!/usr/bin/env bash
# Sätter inloggningsinställningar (adresser och mejlmallar) i Supabase via Management API.
# Kräver SUPABASE_ACCESS_TOKEN och SUPABASE_PROJECT_REF.
set -euo pipefail
cd "$(dirname "$0")/.."

SITE_URL="https://sakselson-a11y.github.io/hundappen/"
REDIRECTS="https://sakselson-a11y.github.io/hundappen/**,http://localhost:5173/hundappen/**"
SUBJECT="Din kod till Hundappen"
API="https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth"

# Anropar API:t. Vid fel skrivs Supabases svar ut och funktionen returnerar 1.
call() {
  local out status
  out=$(mktemp)
  status=$(curl -sS -o "$out" -w '%{http_code}' -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" "$@")
  if [ "$status" -ge 400 ]; then
    LAST_ERROR="Supabase svarade $status: $(head -c 500 "$out" | tr '\n' ' ')"
    return 1
  fi
  cat "$out"
}

json() {
  python3 - "$SITE_URL" "$REDIRECTS" "$SUBJECT" "$1" <<'PY'
import json, sys
site, redirects, subject, part = sys.argv[1:5]
if part == 'urls':
    print(json.dumps({'site_url': site, 'uri_allow_list': redirects}))
else:
    template = open('supabase/templates/login-code.html', encoding='utf-8').read()
    print(json.dumps({
        'mailer_subjects_magic_link': subject,
        'mailer_templates_magic_link_content': template,
        'mailer_subjects_confirmation': subject,
        'mailer_templates_confirmation_content': template,
    }))
PY
}

urls_body=$(json urls)
templates_body=$(json templates)

# 1. Adresser (fungerar alltid).
if ! call -X PATCH "$API" -H "Content-Type: application/json" -d "$urls_body" > /dev/null; then
  echo "::error::$LAST_ERROR" >&2
  exit 1
fi
echo "Site URL och Redirect URLs uppdaterade."

# 2. Mejlmallar med kod. Kräver egen SMTP på gratisnivån.
if ! call -X PATCH "$API" -H "Content-Type: application/json" -d "$templates_body" > /dev/null; then
  if [[ "$LAST_ERROR" == *"custom SMTP"* ]]; then
    echo "::warning::Mejlmallen med kod kunde inte sparas eftersom ingen egen SMTP-tjänst är inkopplad. Den sparas automatiskt vid nästa körning när SMTP är inställt."
    exit 0
  fi
  echo "::error::$LAST_ERROR" >&2
  exit 1
fi

# 3. Kontrollera att allt faktiskt sparades.
config=$(call "$API") || { echo "::error::$LAST_ERROR" >&2; exit 1; }
echo "$config" | python3 -c '
import json, sys
c = json.load(sys.stdin)
ok = True
for key in ("mailer_templates_magic_link_content", "mailer_templates_confirmation_content"):
    if "{{ .Token }}" not in (c.get(key) or ""):
        print(f"::error::{key} saknar koden {{{{ .Token }}}}"); ok = False
if c.get("site_url") != sys.argv[1]:
    print("::error::site_url är " + str(c.get("site_url"))); ok = False
print("Mejlmallar med kod uppdaterade." if ok else "Något sparades inte.")
sys.exit(0 if ok else 1)
' "$SITE_URL"
