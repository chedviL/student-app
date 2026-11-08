-- Monitoring queries + health check detect the seeded anomalies
\i supabase/tests/assert.sql
\i supabase/tests/fixtures/seed_history.sql
\o /dev/null
\i supabase/tuition_monitoring.sql
\o
CREATE TEMP TABLE hc AS SELECT * FROM tuition_health_check('2026-10-01');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'possible_double_charge' AND student_id = pg_temp.u(5)), 'double charge S5 detected');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'unauthorized_auto_credit' AND student_id = pg_temp.u(9)), 'unauthorized credit (א"א) S9 detected');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'missing_auto_credit' AND student_id = pg_temp.u(8)), 'missing credit (מרכז הצדקה) S8 detected');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'paying_student_without_start_date' AND student_id = pg_temp.u(1)
       AND detail LIKE '%חשד למחיקה%'), 'wiped start date S1 flagged as suspected deletion');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'eligible_not_charged' AND student_id = pg_temp.u(13)) = false, 'future start not flagged');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'charged_count_changed'), 'month-over-month change detected (Sep→Oct)');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM hc WHERE check_name = 'unparseable_tuition' AND student_id = pg_temp.u(20)), 'unparseable tuition detected');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM hc WHERE check_name = 'cron_run_missing'), 'Oct has automatic charges → no cron_run_missing');
-- a month with no run at all
SELECT pg_temp.check(EXISTS (SELECT 1 FROM tuition_health_check('2026-07-01') WHERE check_name = 'cron_run_missing'), 'cron_run_missing for a month without any run');
