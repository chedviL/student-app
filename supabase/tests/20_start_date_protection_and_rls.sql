-- tuition_start_date protection, field audit, RLS & privileges
\i supabase/tests/assert.sql

INSERT INTO auth.users (id, email) VALUES ('20000000-0000-0000-0000-0000000000aa', 'secretary@example.test');
INSERT INTO students (id, last_name, class_name, tuition, tuition_rank, tuition_currency, tuition_start_date) VALUES
 ('20000000-0000-0000-0000-000000000001', 'א', 'כיתה ג', '1400', 'אשראי', 'ILS', '2026-08-20'),
 ('20000000-0000-0000-0000-000000000002', 'ב', 'כיתה ג', '1000', 'מזומן', 'ILS', '2026-08-20'),
 ('20000000-0000-0000-0000-000000000003', 'ג', 'כיתה ג', '1000', 'מזומן', 'ILS', NULL);
INSERT INTO tuition_transactions (student_id, billing_month, transaction_date, amount, currency, transaction_type, source)
VALUES ('20000000-0000-0000-0000-000000000001', '2026-10-01', '2026-10-20', -1400, 'ILS', 'monthly_charge', 'automatic');

-- emulate a PostgREST request from a logged-in secretary
CREATE OR REPLACE FUNCTION pg_temp.as_app_user() RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.role', 'authenticated', false),
         set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-0000000000aa', false);
$$;
SELECT pg_temp.as_app_user();
SET ROLE authenticated;

-- partial update (what the fixed client sends) leaves the date intact
UPDATE students SET class_name = 'כיתה ד' WHERE class_name = 'כיתה ג';
SELECT pg_temp.eq((SELECT tuition_start_date FROM students WHERE id = '20000000-0000-0000-0000-000000000001'), date '2026-08-20',
       'bulk class update (66-student scenario) keeps start date');

-- what the OLD client sent: tuition_start_date = NULL → blocked
SELECT pg_temp.raises($$UPDATE students SET tuition = '1400', tuition_rank = 'אשראי', tuition_start_date = NULL
                         WHERE id = '20000000-0000-0000-0000-000000000001'$$,
       'app user cannot NULL tuition_start_date (old buggy payload rejected)');
SELECT pg_temp.raises($$UPDATE students SET class_name = 'x', tuition_start_date = NULL$$,
       'bulk NULL of start dates rejected as a whole');
SELECT pg_temp.eq((SELECT count(*) FROM students WHERE tuition_start_date IS NOT NULL)::int, 2, 'no date was lost');

-- changing to another date is allowed; setting a date where none existed is allowed
UPDATE students SET tuition_start_date = '2026-09-20' WHERE id = '20000000-0000-0000-0000-000000000002';
UPDATE students SET tuition_start_date = '2026-08-20' WHERE id = '20000000-0000-0000-0000-000000000003';
SELECT pg_temp.eq((SELECT tuition_start_date FROM students WHERE id = '20000000-0000-0000-0000-000000000002'), date '2026-09-20', 'date can be changed');
-- NULL → NULL is a no-op and allowed (row already without date)
RESET ROLE;
UPDATE students SET tuition_start_date = NULL WHERE id = '20000000-0000-0000-0000-000000000003';
SELECT pg_temp.as_app_user();
SET ROLE authenticated;
UPDATE students SET tuition_start_date = NULL, class_name = 'ה' WHERE id = '20000000-0000-0000-0000-000000000003';
SELECT pg_temp.eq((SELECT class_name FROM students WHERE id = '20000000-0000-0000-0000-000000000003'), 'ה', 'NULL→NULL update allowed');

-- audit: readable by app, not writable
SELECT pg_temp.check(EXISTS (SELECT 1 FROM student_tuition_audit WHERE field = 'tuition_start_date'
       AND old_value = '2026-08-20' AND new_value = '2026-09-20'
       AND changed_by = '20000000-0000-0000-0000-0000000000aa' AND db_role = 'authenticated'),
       'start date change audited with user id and role');
SELECT pg_temp.raises($$INSERT INTO student_tuition_audit (student_id, operation, field) VALUES (gen_random_uuid(), 'UPDATE', 'x')$$, 'audit not writable by app');
SELECT pg_temp.raises($$DELETE FROM student_tuition_audit$$, 'audit not deletable by app');

-- transactions: app can READ all (no hidden rows for authorized users) …
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions)::int, 1, 'authenticated sees all transactions');
SELECT pg_temp.eq((SELECT current_balance FROM tuition_balances WHERE student_id = '20000000-0000-0000-0000-000000000001'), -1400.00,
       'balance view visible to authenticated');
-- … but cannot write directly or run system functions
SELECT pg_temp.raises($$INSERT INTO tuition_transactions (student_id, billing_month, transaction_date, amount, currency, transaction_type, source)
                         VALUES (gen_random_uuid(), '2026-10-01', '2026-10-20', -1, 'ILS', 'monthly_charge', 'automatic')$$, 'direct insert blocked');
SELECT pg_temp.raises($$UPDATE tuition_transactions SET amount = 0$$, 'direct update blocked');
SELECT pg_temp.raises($$DELETE FROM tuition_transactions$$, 'direct delete blocked');
SELECT pg_temp.raises($$SELECT * FROM process_monthly_tuition()$$, 'authenticated cannot run process_monthly_tuition');
SELECT pg_temp.raises($$INSERT INTO tuition_recovery_log (batch_id, transaction_id, student_id, billing_month, transaction_type, amount, currency, category, evidence, approved_by)
                         VALUES ('x', gen_random_uuid(), gen_random_uuid(), '2026-10-01', 'monthly_charge', -1, 'ILS', 'A', 'x', 'x')$$, 'recovery log not writable by app');
SELECT pg_temp.raises($$INSERT INTO tuition_processing_runs (billing_month) VALUES ('2026-10-01')$$, 'run log not writable by app');
-- manual transactions still work through the RPC (secretaries' workflow unchanged)
SELECT pg_temp.check((add_manual_transaction('20000000-0000-0000-0000-000000000002', '2026-10-01', '2026-10-25', 1000, 'ILS', 'manual_payment', 'מזומן')).created_by
       = '20000000-0000-0000-0000-0000000000aa', 'manual payment via RPC with created_by');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM tuition_health_check('2026-10-01')), 'health check callable by authenticated');
RESET ROLE;

-- anon sees nothing
SELECT set_config('request.jwt.claim.role', 'anon', false), set_config('request.jwt.claim.sub', '', false);
SET ROLE anon;
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions)::int, 0, 'anon: transactions hidden by RLS');
SELECT pg_temp.eq((SELECT count(*) FROM students)::int, 0, 'anon: students hidden by RLS');
SELECT pg_temp.raises($$SELECT * FROM student_tuition_audit$$, 'anon: audit not accessible');
UPDATE students SET tuition_start_date = NULL;  -- RLS: matches 0 rows
RESET ROLE;
SELECT pg_temp.eq((SELECT count(*) FROM students WHERE tuition_start_date IS NOT NULL)::int, 2, 'all dates intact after anon attempt (2 with date)');

-- admin (SQL editor / service_role) may still clear deliberately — and it is audited
SET ROLE service_role;
UPDATE students SET tuition_start_date = NULL WHERE id = '20000000-0000-0000-0000-000000000002';
RESET ROLE;
SELECT pg_temp.check(EXISTS (SELECT 1 FROM student_tuition_audit WHERE student_id = '20000000-0000-0000-0000-000000000002'
       AND field = 'tuition_start_date' AND new_value IS NULL), 'admin clear is allowed and audited');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM tuition_health_check() WHERE check_name = 'start_date_cleared'
       AND student_id = '20000000-0000-0000-0000-000000000002'), 'health check reports the cleared start date');

-- graduation (DELETE) is audited with the last values
DELETE FROM students WHERE id = '20000000-0000-0000-0000-000000000001';
SELECT pg_temp.check(EXISTS (SELECT 1 FROM student_tuition_audit WHERE student_id = '20000000-0000-0000-0000-000000000001'
       AND operation = 'DELETE' AND field = 'tuition' AND old_value = '1400'), 'delete/graduation audited');
