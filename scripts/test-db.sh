#!/usr/bin/env bash
# Kör migreringar och RLS-tester mot en lokal Postgres (tom testdatabas skapas varje gång).
# Användning: PGHOST=/tmp PGPORT=5433 PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=hundappen_test
dropdb --if-exists "$DB"
createdb "$DB"
export PGDATABASE="$DB"
psql -q -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
