#!/usr/bin/env bash
# Two simultaneous runs of process_monthly_tuition (cron retry + manual) must not duplicate.
set -euo pipefail
P=(psql -X -q -v ON_ERROR_STOP=1 -At)
"${P[@]}" -c "insert into students (last_name, tuition, tuition_rank, tuition_currency, tuition_start_date)
              select 'c'||g, '1000', case when g % 2 = 0 then 'אשראי' else 'מזומן' end, 'ILS', current_date - 40
              from generate_series(1, 300) g" >/dev/null
for i in 1 2 3 4; do "${P[@]}" -c "select count(*) from process_monthly_tuition()" >/dev/null & done
wait
C=$("${P[@]}" -c "select count(*) from tuition_transactions where transaction_type='monthly_charge'")
R=$("${P[@]}" -c "select count(*) from tuition_transactions where transaction_type='automatic_payment'")
[ "$C" = "300" ] && echo "ok 4 parallel runs → 300 charges" || { echo "FAILED charges $C"; exit 1; }
[ "$R" = "150" ] && echo "ok 4 parallel runs → 150 credits" || { echo "FAILED credits $R"; exit 1; }
N=$("${P[@]}" -c "select count(*) from tuition_processing_runs where status='success'")
[ "$N" = "4" ] && echo "ok all 4 runs logged" || { echo "FAILED runs $N"; exit 1; }
