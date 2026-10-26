#!/usr/bin/env bash
# Kör migreringar och databastester mot en lokal Postgres.
# Varje testfil får en ny, tom databas så att testerna inte påverkar varandra.
# Användning: PGHOST=/tmp PGPORT=5433 PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB=hundappen_test

for test in supabase/tests/*_test.sql; do
  dropdb --if-exists "$DB"
  createdb "$DB"
  PGDATABASE="$DB" psql -q -v ON_ERROR_STOP=1 -f supabase/tests/supabase_stub.sql
  for f in supabase/migrations/*.sql; do
    PGDATABASE="$DB" psql -q -v ON_ERROR_STOP=1 -f "$f"
  done
  PGDATABASE="$DB" psql -q -v ON_ERROR_STOP=1 -f "$test"
done
