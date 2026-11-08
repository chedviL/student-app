#!/usr/bin/env bash
# Runs the SQL test-suite against a THROWAWAY local PostgreSQL cluster.
# Never connects to Supabase / production. Requires PostgreSQL 15+ binaries.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
WORK="$(mktemp -d)"
PORT="${TEST_PG_PORT:-55432}"
RUN_AS=""
if [ "$(id -u)" = "0" ]; then
  id -u postgres >/dev/null 2>&1 || useradd -m postgres
  chown -R postgres "$WORK"
  RUN_AS="runuser -u postgres --"
fi
cleanup() { $RUN_AS "$PGBIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

$RUN_AS "$PGBIN/initdb" -D "$WORK/data" -U postgres --locale=C.UTF-8 -E UTF8 >/dev/null
$RUN_AS "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses='' -c timezone=UTC" -l "$WORK/log" -w start >/dev/null

export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
run() { echo "  · $1"; "${PSQL[@]}" -d tmpl -f "$1" >/dev/null; }

echo "▶ Building template DB (same order as production history)"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE tmpl" >/dev/null
cd "$ROOT/supabase"
run tests/00_supabase_stub.sql
run schema.sql
"${PSQL[@]}" -d tmpl -c "ALTER TABLE students ENABLE ROW LEVEL SECURITY;" >/dev/null
run policies.sql
run alumni_schema.sql
run tuition_migration.sql
run tuition_backfill.sql
run migration_v4_audit_cancellation_profiles.sql
run migration_alumni_tuition_currency.sql
run migration_v5_tuition_integrity.sql
echo "  · migration_v5_tuition_integrity.sql (second run — must be re-runnable)"
"${PSQL[@]}" -d tmpl -f migration_v5_tuition_integrity.sql >/dev/null

cd "$ROOT"
echo "▶ Running tests (each in a fresh copy of the template)"
FAILED=0; N=0
for t in supabase/tests/[1-9]*.sql supabase/tests/[1-9]*.sh; do
  [ -e "$t" ] || continue
  N=$((N+1)); db="t$N"
  "${PSQL[@]}" -d postgres -c "CREATE DATABASE $db TEMPLATE tmpl" >/dev/null
  if [[ "$t" == *.sh ]]; then
    if PGDATABASE="$db" bash "$t" > "$WORK/out.txt" 2>&1; then ok=1; else ok=0; fi
  else
    if "${PSQL[@]}" -d "$db" -f "$t" > "$WORK/out.txt" 2>&1; then ok=1; else ok=0; fi
  fi
  if [ $ok = 1 ]; then
    echo "  ✔ $(basename "$t") $(grep -c '^ok ' "$WORK/out.txt" || true) checks"
  else
    echo "  ✘ $(basename "$t")"; sed 's/^/      /' "$WORK/out.txt"; FAILED=1
  fi
done
[ $FAILED = 0 ] && echo "▶ ALL DB TESTS PASSED ($N files)" || echo "▶ DB TESTS FAILED"
exit $FAILED
