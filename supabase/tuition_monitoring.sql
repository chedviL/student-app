-- ============================================================
-- TUITION MONITORING — read-only
-- ============================================================
-- After migration v5 the main tool is:
--     select * from tuition_health_check();               -- current month
--     select * from tuition_health_check('2026-10-01');   -- a given month
-- It detects:
--   cron_run_missing                      cron did not run / did not finish (after the 21st)
--   eligible_not_charged                  eligible student without a charge
--   possible_double_charge                automatic charge + manual charge/negative adjustment in the same month
--   missing_auto_credit                   approved rank, charged, no automatic credit
--   unauthorized_auto_credit              automatic credit, current rank not approved
--   credit_charge_mismatch                credit amount/currency ≠ charge
--   start_date_cleared                    tuition_start_date set to NULL (audit trail, 45 days)
--   paying_student_without_start_date     will be skipped by the cron (flags "was charged before")
--   unparseable_tuition                   tuition text the cron cannot read (e.g. '1,400')
--   currency_mismatch_hidden_from_balance tx in a currency the balance view does not count
--   charged_count_changed                 >10% change in charged students vs previous month
--
-- The payments overview screen also shows a data-driven status badge (last
-- automatic month, count, and a warning on a >15% drop).
-- ============================================================

-- ── M1: last processing runs (v5) ──
SELECT billing_month, started_at, finished_at, invoked_by, eligible_students,
       charges_created, charges_existing, credits_created, credits_existing,
       skipped_no_start_date, skipped_future_start, status
FROM public.tuition_processing_runs ORDER BY started_at DESC LIMIT 12;

-- ── M2: charged / credited per month (works before v5 too) ──
SELECT billing_month,
       count(*) FILTER (WHERE transaction_type = 'monthly_charge')    AS charges,
       count(*) FILTER (WHERE transaction_type = 'automatic_payment') AS credits,
       count(*) FILTER (WHERE transaction_type = 'monthly_charge') -
         lag(count(*) FILTER (WHERE transaction_type = 'monthly_charge')) OVER (ORDER BY billing_month) AS charges_delta
FROM public.tuition_transactions
WHERE source = 'automatic' AND cancelled_at IS NULL
GROUP BY billing_month ORDER BY billing_month;

-- ── M3: manual charges that may overlap automatic ones (any month) ──
SELECT t.student_id,
       coalesce(s.last_name || ' ' || s.first_name, a.last_name || ' ' || a.first_name, '(לא נמצא)') AS name,
       t.billing_month, t.currency,
       string_agg(t.transaction_type || ' ' || t.amount::text || coalesce(' "' || t.note || '"', ''), ' | ' ORDER BY t.created_at) AS rows
FROM public.tuition_transactions t
LEFT JOIN public.students s ON s.id = t.student_id
LEFT JOIN public.alumni   a ON a.id = t.student_id
WHERE t.cancelled_at IS NULL
  AND (t.transaction_type IN ('monthly_charge', 'manual_charge') OR (t.transaction_type = 'adjustment' AND t.amount < 0))
GROUP BY t.student_id, name, t.billing_month, t.currency
HAVING count(*) FILTER (WHERE t.transaction_type = 'monthly_charge') >= 1
   AND count(*) FILTER (WHERE t.transaction_type <> 'monthly_charge') >= 1
ORDER BY t.billing_month DESC, name;

-- ── M4: start dates cleared recently (v5 audit) ──
SELECT au.changed_at, au.student_id, s.last_name, s.first_name, au.old_value, au.db_role, au.changed_by
FROM public.student_tuition_audit au
LEFT JOIN public.students s ON s.id = au.student_id
WHERE au.field = 'tuition_start_date' AND au.new_value IS NULL AND au.old_value IS NOT NULL
ORDER BY au.changed_at DESC LIMIT 50;

-- ── M5 (optional, NOT enabled — requires approval): daily health check via pg_cron ──
-- Writes nothing by itself; the job result appears in cron.job_run_details.
-- select cron.schedule('tuition-health-check', '30 6 * * *',
--   $$select count(*) filter (where severity = 'critical') from public.tuition_health_check()$$);
