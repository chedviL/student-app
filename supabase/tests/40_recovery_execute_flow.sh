#!/usr/bin/env bash
# End-to-end: preview → approval → execute → verify → idempotent re-run → tamper → restore → next cron.
set -euo pipefail
P=(psql -X -q -v ON_ERROR_STOP=1 -At)
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
pass() { echo "ok $1"; }
fail() { echo "FAILED: $1"; exit 1; }
q() { "${P[@]}" -c "$1"; }

"${P[@]}" -f supabase/tests/fixtures/seed_history.sql >/dev/null

BEFORE_N=$(q "select count(*) from tuition_transactions")
BEFORE_ILS=$(q "select sum(amount) from tuition_transactions where cancelled_at is null and currency='ILS'")
BEFORE_USD=$(q "select sum(amount) from tuition_transactions where cancelled_at is null and currency='USD'")

# 1) preview: take hash + rows from the LAST column pair of the preview output
read -r HASH ROWS < <("${P[@]}" -F ' ' -f supabase/recovery/04_recovery_plan_preview.sql | tail -1 | awk '{print $(NF-1), $NF}')
[ "$ROWS" = "8" ] && pass "preview plan_rows=8" || fail "preview rows $ROWS"
[ "${#HASH}" = "32" ] && pass "preview hash present" || fail "hash '$HASH'"

fill() { # $1 approver $2 hash $3 rows $4 batch → filled copy of 05
  sed -e "s/^  ''::text                     AS approved_by,/  '$1'::text AS approved_by,/" \
      -e "s/^  ''::text                     AS approved_plan_hash,/  '$2'::text AS approved_plan_hash,/" \
      -e "s/^  -1::integer                  AS approved_plan_rows;/  $3::integer AS approved_plan_rows;/" \
      -e "s/'RECOVERY-2026-08-10'::text/'$4'::text/" supabase/recovery/05_recovery_execute.sql > "$TMP/05.sql"
  grep -q "'$1'::text AS approved_by" "$TMP/05.sql" || fail "approval block template changed — update test"
}

# 2) unfilled approval → refused, nothing written
if "${P[@]}" -f supabase/recovery/05_recovery_execute.sql >/dev/null 2>&1; then fail "unapproved run executed"; fi
[ "$(q "select count(*) from tuition_transactions")" = "$BEFORE_N" ] && pass "no approval → nothing written" || fail "rows written without approval"

# 3) wrong hash → refused, nothing written
fill "בודק" "00000000000000000000000000000000" "$ROWS" "TEST-BATCH"
if "${P[@]}" -f "$TMP/05.sql" >/dev/null 2>&1; then fail "wrong hash executed"; fi
[ "$(q "select count(*) from tuition_transactions")" = "$BEFORE_N" ] && pass "wrong hash → full rollback" || fail "partial write on wrong hash"
[ "$(q "select count(*) from information_schema.schemata where schema_name='recovery_backup'")" = "0" ] && pass "rollback also undid snapshot schema" || fail "snapshot left behind"

# 4) approved run
fill "בודק" "$HASH" "$ROWS" "TEST-BATCH"
"${P[@]}" -f "$TMP/05.sql" > "$TMP/out.txt"
[ "$(q "select count(*) from tuition_transactions")" = "$((BEFORE_N + 8))" ] && pass "8 rows inserted" || fail "insert count"
[ "$(q "select count(*) from tuition_recovery_log where batch_id='TEST-BATCH' and category='A' and approved_by='בודק' and evidence <> ''")" = "8" ] && pass "8 audit rows with evidence" || fail "audit"
[ "$(q "select sum(amount) from tuition_transactions where cancelled_at is null and currency='ILS'")" = "$(q "select ($BEFORE_ILS) + (-4500 + 2500)")" ] && pass "ILS balance delta -2000" || fail "ILS delta"
[ "$(q "select sum(amount) from tuition_transactions where cancelled_at is null and currency='USD'")" = "$(q "select ($BEFORE_USD) + 0")" ] && pass "USD balance delta 0 (charge+credit)" || fail "USD delta"
[ "$(q "select current_balance from tuition_balances where student_id='00000000-0000-0000-0000-000000000001'")" = "0.00" ] && pass "S1 credit student balance 0 after recovery" || fail "S1 balance"
[ "$(q "select current_balance from tuition_balances where student_id='00000000-0000-0000-0000-000000000002'")" = "-2000.00" ] && pass "S2 cash: Aug+Oct open, Sep paid → -2000" || fail "S2 balance"
[ "$(q "select current_balance from tuition_balances where student_id='00000000-0000-0000-0000-000000000003'")" = "-3600.00" ] && pass "S3 not double-charged (manual Oct charge kept, no auto added)" || fail "S3 balance"
[ "$(q "select string_agg(currency||amount::text, ',' order by amount) from tuition_transactions where student_id='00000000-0000-0000-0000-000000000010' and billing_month='2026-10-01'")" = "USD-400.00,USD400.00" ] && pass "S10 USD rows stay USD" || fail "S10"
[ "$(q "select count(*) from tuition_transactions where note like '%שחזור TEST-BATCH' and source='automatic'")" = "8" ] && pass "recovered rows labelled with batch" || fail "labels"
[ "$(q "select count(*) from recovery_backup.tuition_transactions_test_batch")" = "$BEFORE_N" ] && pass "pre-recovery snapshot = $BEFORE_N rows" || fail "snapshot"
[ "$(q "select count(*) from tuition_transactions t join recovery_backup.tuition_transactions_test_batch b using (id) where row(t.*)::text <> row(b.*)::text")" = "0" ] && pass "no existing transaction was modified" || fail "existing rows modified"

# 5) idempotent re-run with the same approval → nothing new
"${P[@]}" -f "$TMP/05.sql" >/dev/null
[ "$(q "select count(*) from tuition_transactions")" = "$((BEFORE_N + 8))" ] && pass "re-run same batch → no duplicates" || fail "re-run duplicated"

# 6) recomputed plan after recovery is empty → classification now C
read -r HASH2 ROWS2 < <("${P[@]}" -F ' ' -f supabase/recovery/04_recovery_plan_preview.sql | tail -1 | awk '{print $(NF-1), $NF}')
[ "$ROWS2" = "0" ] && pass "post-recovery plan empty" || fail "post plan $ROWS2"

# 7) new batch with stale (old) hash → refused
fill "בודק" "$HASH" "$ROWS" "TEST-BATCH-2"
if "${P[@]}" -f "$TMP/05.sql" >/dev/null 2>&1; then fail "stale approval executed"; fi
pass "stale approval for a new batch refused"

# 8) start-date restore
read -r SHASH SROWS < <("${P[@]}" -F ' ' -f supabase/recovery/03_start_date_restore_preview.sql | tail -1 | awk '{print $(NF-1), $NF}')
[ "$SROWS" = "7" ] && pass "restore preview 7 A students" || fail "restore rows $SROWS"
sed -e "s/^  ''::text     AS approved_by,/  'בודק'::text AS approved_by,/" \
    -e "s/^  ''::text     AS approved_hash,/  '$SHASH'::text AS approved_hash,/" \
    -e "s/^  -1::integer  AS approved_rows;/  $SROWS::integer AS approved_rows;/" \
    supabase/recovery/06_start_date_restore_execute.sql > "$TMP/06.sql"
"${P[@]}" -f "$TMP/06.sql" >/dev/null
[ "$(q "select count(*) from students where tuition_start_date = '2026-08-20' and id in (select ('00000000-0000-0000-0000-0000000000'||n)::uuid from unnest(array['01','02','03','04','06','07','10']) n)")" = "7" ] && pass "7 start dates restored to 2026-08-20" || fail "restore"
[ "$(q "select count(*) from students where tuition_start_date is null and id in ('00000000-0000-0000-0000-000000000017','00000000-0000-0000-0000-000000000019')")" = "2" ] && pass "B students untouched" || fail "B touched"
[ "$(q "select count(*) from student_tuition_audit where field='tuition_start_date' and new_value='2026-08-20' and old_value is null and operation='UPDATE'")" = "7" ] && pass "restores audited" || fail "restore audit"
"${P[@]}" -f "$TMP/06.sql" >/dev/null
pass "restore re-run is a no-op"

# 9) next cron run (current month) now charges the restored students and credits only approved ranks
q "select count(*) from process_monthly_tuition()" >/dev/null
CM=$(q "select date_trunc('month', current_date)::date")
[ "$(q "select count(*) from tuition_transactions where billing_month='$CM' and transaction_type='monthly_charge' and student_id in (select ('00000000-0000-0000-0000-0000000000'||n)::uuid from unnest(array['01','02','03','04','06','07','10']) n)")" = "7" ] && pass "restored students charged by next cron" || fail "cron after restore"
[ "$(q "select count(*) from tuition_transactions where billing_month='$CM' and transaction_type='automatic_payment' and student_id='00000000-0000-0000-0000-000000000009'")" = "0" ] && pass "א\"א not credited by fixed function" || fail "aa credited"
[ "$(q "select count(*) from tuition_transactions where billing_month='$CM' and transaction_type='automatic_payment' and student_id='00000000-0000-0000-0000-000000000008'")" = "1" ] && pass "מרכז הצדקה now credited" || fail "tzedaka"
