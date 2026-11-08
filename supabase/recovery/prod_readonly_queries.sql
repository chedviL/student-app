-- ============================================================
-- PRODUCTION READ-ONLY QUERIES — run each one separately in the SQL Editor
-- SELECT only. Nothing here changes data or schema.
-- Please send back the output of each (screenshot / CSV).
-- ============================================================

-- ── PROD-Q1: the DEPLOYED process_monthly_tuition (save it! it is the rollback for v5) ──
-- The repository copy differs from production (prod writes dates 20/21), so the
-- exact deployed rank list and logic must be read from the database itself.
SELECT pg_get_functiondef('public.process_monthly_tuition(date)'::regprocedure);

-- ── PROD-Q2: cron definition + last runs ──
SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobid;
SELECT j.jobname, d.status, d.start_time, d.end_time, left(d.return_message, 200) AS message
FROM cron.job_run_details d JOIN cron.job j USING (jobid)
WHERE j.jobname = 'monthly-tuition-processing'
ORDER BY d.start_time DESC LIMIT 12;

-- ── PROD-Q3: exact tuition_rank strings (detects gershayim ״ vs ", stray spaces, variants) ──
SELECT tuition_rank, length(tuition_rank) AS len, encode(convert_to(tuition_rank, 'UTF8'), 'hex') AS hex,
       count(*) AS students
FROM public.students GROUP BY tuition_rank ORDER BY students DESC;

-- ── PROD-Q4: duplicate-protection indexes exist (required for idempotency) ──
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'tuition_transactions' ORDER BY indexname;

-- ── PROD-Q5: triggers on students / tuition_transactions ──
SELECT c.relname AS table_name, t.tgname, pg_get_triggerdef(t.oid) AS def
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE c.relname IN ('students', 'tuition_transactions', 'alumni') AND NOT t.tgisinternal;

-- ── PROD-Q6: RLS policies and privileges (is anything hidden from authorized users?) ──
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('students', 'alumni', 'tuition_transactions', 'profiles') ORDER BY 1, 2;
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
WHERE relname IN ('students', 'alumni', 'tuition_transactions', 'profiles');
SELECT grantee, table_name, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('students', 'tuition_transactions', 'tuition_balances', 'tuition_monthly_history')
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee, table_name ORDER BY 2, 1;

-- ── PROD-Q7: deployed view definitions ──
SELECT 'tuition_balances' AS view, pg_get_viewdef('public.tuition_balances'::regclass, true)
UNION ALL
SELECT 'tuition_monthly_history', pg_get_viewdef('public.tuition_monthly_history'::regclass, true);

-- ── PROD-Q8: tuition_transactions columns (does prod match the repo?) ──
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tuition_transactions'
ORDER BY ordinal_position;

-- ── PROD-Q9: ROOT-CAUSE EVIDENCE — students whose start date is NULL but who WERE charged,
--    grouped by the day of their last update (expect a cluster on 2026-10-15) ──
SELECT date(s.updated_at) AS last_update_day, count(*) AS students,
       string_agg(DISTINCT coalesce(s.class_name, '—'), ', ') AS classes
FROM public.students s
WHERE s.tuition_start_date IS NULL
  AND EXISTS (SELECT 1 FROM public.tuition_transactions t
              WHERE t.student_id = s.id AND t.transaction_type = 'monthly_charge' AND t.source = 'automatic')
GROUP BY 1 ORDER BY 1;

-- ── PROD-Q10: distribution of start dates (separates the deliberate 2026-08-20 reset from NULLs) ──
SELECT tuition_start_date, count(*) FROM public.students GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

-- ── PROD-Q11: when were automatic rows actually written, and with which value dates ──
SELECT billing_month, transaction_type, transaction_date, date(created_at) AS created_day,
       count(*) AS n, min(created_at) AS first_created, max(created_at) AS last_created
FROM public.tuition_transactions WHERE source = 'automatic'
GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3, 4;

-- ── PROD-Q12: manual activity per month — who entered what, and when ──
SELECT t.billing_month, t.transaction_type, t.currency, date(t.created_at) AS created_day,
       coalesce(p.display_name, t.created_by::text, '(ללא משתמש)') AS entered_by,
       count(*) AS n, sum(t.amount) AS total,
       count(*) FILTER (WHERE t.cancelled_at IS NOT NULL) AS cancelled
FROM public.tuition_transactions t
LEFT JOIN public.profiles p ON p.id = t.created_by
WHERE t.source = 'manual'
GROUP BY 1, 2, 3, 4, 5 ORDER BY 1, 4, 2;

-- ── PROD-Q13: other transaction types or sources than expected ──
SELECT transaction_type, source, count(*) FROM public.tuition_transactions GROUP BY 1, 2 ORDER BY 1, 2;

-- ── PROD-Q14: point-in-time recovery / backups ──
-- Not visible from SQL. Please confirm in Dashboard → Database → Backups:
--   • the plan includes PITR or daily backups, and
--   • the timestamp of the latest successful backup.
-- And in Dashboard → Settings → API: the value of "Max rows" (default 1000).
