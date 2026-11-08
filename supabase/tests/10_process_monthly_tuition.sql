-- process_monthly_tuition (v5) — business rules
\i supabase/tests/assert.sql
\set cm 'date_trunc(''month'', current_date)::date'

-- one student per rank + edge cases. start date: last month unless stated.
INSERT INTO students (id, last_name, tuition, tuition_rank, tuition_currency, tuition_start_date) VALUES
 ('10000000-0000-0000-0000-000000000001', 'אשראי',        '1400', 'אשראי',       'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000002', 'בנקאי',        '1000', 'בנקאי',       'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000003', 'קירוב',        '900',  'קירוב לבבות', 'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000004', 'צדקה',         '800',  'מרכז הצדקה',  'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000005', 'מזומן',        '1400', 'מזומן',       'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000006', 'אא',           '700',  'א"א',         'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000007', 'שלילי',        '600',  'שלילי',       'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000008', 'אחר',          '500',  'כן',          'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000009', 'ריק',          '500',  NULL,          'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000010', 'דולר-אשראי',   '400',  'אשראי',       'USD', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000011', 'דולר-מזומן',   '350',  'מזומן',       'USD', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000012', 'ללא-תאריך',    '1000', 'אשראי',       'ILS', NULL),
 ('10000000-0000-0000-0000-000000000013', 'מתחיל-בעתיד',  '1000', 'אשראי',       'ILS', (:cm + 40)),
 ('10000000-0000-0000-0000-000000000014', 'מתחיל-החודש-25','1000','אשראי',       'ILS', (:cm + 24)),
 ('10000000-0000-0000-0000-000000000015', 'שכל-אפס',      '0',    'אשראי',       'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000016', 'שכל-טקסט',     '1,400','אשראי',       'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000017', 'ללא-מטבע',     '1000', 'אשראי',       NULL,  (:cm - 30)),
 ('10000000-0000-0000-0000-000000000018', 'דירוג-רווחים', '1000', '  בנקאי ',    'ILS', (:cm - 30)),
 ('10000000-0000-0000-0000-000000000019', 'עשרוני',       '1250.50','אשראי',     'ILS', (:cm - 30));

SELECT count(*) AS rows_returned FROM process_monthly_tuition() \gset
\pset tuples_only on

-- charge for every eligible rank
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions WHERE transaction_type='monthly_charge')::int, 14,
       'charge created for every eligible student regardless of rank (14)');
SELECT pg_temp.eq((SELECT array_agg(right(student_id::text,2) ORDER BY student_id) FROM tuition_transactions WHERE transaction_type='monthly_charge'),
       ARRAY['01','02','03','04','05','06','07','08','09','10','11','14','18','19'], 'exact eligible set');
-- credit only for 4 approved ranks
SELECT pg_temp.eq((SELECT array_agg(right(student_id::text,2) ORDER BY student_id) FROM tuition_transactions WHERE transaction_type='automatic_payment'),
       ARRAY['01','02','03','04','10','14','18','19'], 'credit only for אשראי/בנקאי/קירוב לבבות/מרכז הצדקה (incl. trimmed rank)');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM tuition_transactions WHERE transaction_type='automatic_payment'
       AND student_id IN ('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000011')),
       'no credit for מזומן / א"א / שלילי / other / empty rank / USD cash');
-- dates 20 / 21
SELECT pg_temp.check(bool_and(transaction_date = :cm + 19), 'charge transaction_date = 20th') FROM tuition_transactions WHERE transaction_type='monthly_charge';
SELECT pg_temp.check(bool_and(transaction_date = :cm + 20), 'credit transaction_date = 21st') FROM tuition_transactions WHERE transaction_type='automatic_payment';
SELECT pg_temp.check(bool_and(billing_month = :cm), 'billing_month = first of month') FROM tuition_transactions;
-- amounts and currency
SELECT pg_temp.eq((SELECT amount FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000001' AND transaction_type='monthly_charge'), -1400.00, 'ILS charge -1400');
SELECT pg_temp.eq((SELECT amount FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000001' AND transaction_type='automatic_payment'), 1400.00, 'ILS credit +1400');
SELECT pg_temp.eq((SELECT currency || amount::text FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000010' AND transaction_type='monthly_charge'), 'USD-400.00', 'USD charge stays USD, no conversion');
SELECT pg_temp.eq((SELECT currency || amount::text FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000010' AND transaction_type='automatic_payment'), 'USD400.00', 'USD credit stays USD');
SELECT pg_temp.eq((SELECT amount FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000019' AND transaction_type='monthly_charge'), -1250.50, 'decimal tuition');
SELECT pg_temp.eq((SELECT sum(amount) FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000005'), -1400.00, 'cash student balance = -1400 until manual payment');
SELECT pg_temp.eq((SELECT sum(amount) FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000001'), 0.00, 'credit student net 0');
-- skipped cases
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM tuition_transactions WHERE student_id IN
       ('10000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000015','10000000-0000-0000-0000-000000000016','10000000-0000-0000-0000-000000000017')),
       'no start date / future start / zero / unparseable / no currency → not charged, no crash');
-- run log
SELECT pg_temp.eq((SELECT format('%s/%s/%s/%s/%s', eligible_students, charges_created, credits_created, skipped_no_start_date, skipped_future_start)
                   FROM tuition_processing_runs ORDER BY id DESC LIMIT 1), '14/14/8/1/1', 'run log counts');
SELECT pg_temp.eq(:rows_returned::int, 22, 'function result rows (14 charges + 8 credits)');

-- ── idempotency: second run (cron retry) creates nothing ──
SELECT count(*) FROM process_monthly_tuition();
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions)::int, 22, 'double cron run → no duplicates');
SELECT pg_temp.eq((SELECT format('%s/%s/%s/%s', charges_created, charges_existing, credits_created, credits_existing)
                   FROM tuition_processing_runs ORDER BY id DESC LIMIT 1), '0/14/0/8', 'second run logged as all-existing');

-- ── amount change after the charge: credit mirrors the ACTIVE charge, not the new tuition ──
INSERT INTO students (id, last_name, tuition, tuition_rank, tuition_currency, tuition_start_date)
VALUES ('10000000-0000-0000-0000-000000000030', 'שינוי-סכום', '1000', 'מזומן', 'ILS', (:cm - 30));
SELECT count(*) FROM process_monthly_tuition();
UPDATE students SET tuition = '1500', tuition_rank = 'אשראי' WHERE id = '10000000-0000-0000-0000-000000000030';
SELECT count(*) FROM process_monthly_tuition();
SELECT pg_temp.eq((SELECT amount FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000030' AND transaction_type='automatic_payment'), 1000.00,
       'rank changed to אשראי mid-month: credit = existing charge (1000), not new tuition (1500)');
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000030' AND transaction_type='monthly_charge')::int, 1,
       'tuition change does not create a second charge');

-- ── cancelled automatic charge is respected (not recreated, no credit) ──
INSERT INTO students (id, last_name, tuition, tuition_rank, tuition_currency, tuition_start_date)
VALUES ('10000000-0000-0000-0000-000000000031', 'בוטל', '1000', 'אשראי', 'ILS', (:cm - 30));
INSERT INTO tuition_transactions (student_id, billing_month, transaction_date, amount, currency, transaction_type, source, cancelled_at, cancellation_reason)
VALUES ('10000000-0000-0000-0000-000000000031', :cm, :cm + 19, -1000, 'ILS', 'monthly_charge', 'automatic', now(), 'הוחלט לא לחייב');
SELECT count(*) FROM process_monthly_tuition();
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000031')::int, 1,
       'cancelled charge not recreated and no credit added');

-- ── graduation (DELETE from students) → no further charges ──
DELETE FROM students WHERE id = '10000000-0000-0000-0000-000000000002';
INSERT INTO students (id, last_name, tuition, tuition_rank, tuition_currency, tuition_start_date)
VALUES ('10000000-0000-0000-0000-000000000032', 'הפסיק', '0', 'אשראי', 'ILS', (:cm - 30));
SELECT count(*) FROM process_monthly_tuition();
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000032'),
       'inactive (tuition 0) student not charged');
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions WHERE student_id='10000000-0000-0000-0000-000000000002')::int, 2,
       'graduated student history preserved (no FK cascade)');

-- ── past / future months refused (blind backfill guard) ──
SELECT pg_temp.raises($$SELECT * FROM process_monthly_tuition((date_trunc('month', current_date) - interval '1 month')::date)$$, 'past month refused');
SELECT pg_temp.raises($$SELECT * FROM process_monthly_tuition((date_trunc('month', current_date) + interval '1 month')::date)$$, 'future month refused');
SELECT pg_temp.raises($$SELECT * FROM run_tuition_backfill()$$, 'run_tuition_backfill disabled');
-- mid-month date normalizes to month start
SELECT count(*) FROM process_monthly_tuition((date_trunc('month', current_date) + interval '14 days')::date);
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM tuition_transactions WHERE billing_month <> :cm), 'mid-month argument normalized');

-- ── health check is clean right after a correct run (except the known skipped students) ──
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM tuition_health_check() WHERE check_name IN
       ('possible_double_charge','unauthorized_auto_credit','credit_charge_mismatch')), 'health check: no duplicates / unauthorized / mismatched credits');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM tuition_health_check() WHERE check_name = 'paying_student_without_start_date'
       AND student_id = '10000000-0000-0000-0000-000000000012'), 'health check flags paying student without start date');
SELECT pg_temp.check(EXISTS (SELECT 1 FROM tuition_health_check() WHERE check_name = 'unparseable_tuition'
       AND student_id = '10000000-0000-0000-0000-000000000016'), 'health check flags unparseable tuition "1,400"');
