-- Reconciliation A/B/C classification on synthetic history (generated files under test)
\i supabase/tests/assert.sql
\i supabase/tests/fixtures/seed_history.sql
\o /dev/null
\i supabase/recovery/04_recovery_plan_preview.sql
\o

CREATE OR REPLACE FUNCTION pg_temp.cat(n int, m date) RETURNS text LANGUAGE sql AS
$$ SELECT string_agg(category, ',' ORDER BY currency NULLS LAST) FROM recon_result WHERE student_id = pg_temp.u(n) AND month = m $$;
CREATE OR REPLACE FUNCTION pg_temp.has_reason(n int, m date, code text) RETURNS boolean LANGUAGE sql AS
$$ SELECT EXISTS (SELECT 1 FROM recon_result r, unnest(r.b_reasons) x WHERE r.student_id = pg_temp.u(n) AND r.month = m AND x LIKE code || ':%') $$;

-- A: verified
SELECT pg_temp.eq(pg_temp.cat(1, '2026-10-01'), 'A', 'S1 credit student, start date wiped → Oct A');
SELECT pg_temp.eq(pg_temp.cat(1, '2026-09-01'), 'C', 'S1 Sep complete → C');
SELECT pg_temp.eq(pg_temp.cat(2, '2026-10-01'), 'A', 'S2 cash student wiped → Oct A (charge only)');
SELECT pg_temp.eq(pg_temp.cat(10, '2026-10-01'), 'A', 'S10 USD credit student wiped → Oct A');
SELECT pg_temp.eq(pg_temp.cat(12, '2026-09-01'), 'A', 'S12 Sep gap between Aug and Oct → A');
SELECT pg_temp.eq(pg_temp.cat(19, '2026-10-01'), 'A', 'S19 Oct after Sep charge → A');
-- B: needs human
SELECT pg_temp.eq(pg_temp.cat(3, '2026-10-01'), 'B', 'S3 manual charge in same month (replacement) → B');
SELECT pg_temp.check(pg_temp.has_reason(3, '2026-10-01', 'MANUAL_CHARGE_SAME_MONTH'), 'S3 reason MANUAL_CHARGE_SAME_MONTH');
SELECT pg_temp.eq(pg_temp.cat(4, '2026-10-01'), 'B', 'S4 manual charge under Nov created after Oct 20 → B');
SELECT pg_temp.check(pg_temp.has_reason(4, '2026-10-01', 'LATE_MANUAL_CHARGE_OTHER_MONTH'), 'S4 reason LATE_MANUAL_CHARGE_OTHER_MONTH');
SELECT pg_temp.eq(pg_temp.cat(5, '2026-10-01'), 'B', 'S5 auto + extra manual charge → B (review, no action)');
SELECT pg_temp.check(pg_temp.has_reason(5, '2026-10-01', 'POSSIBLE_DOUBLE_CHARGE'), 'S5 reason POSSIBLE_DOUBLE_CHARGE');
SELECT pg_temp.check((SELECT suspected_duplicate FROM recon_result WHERE student_id = pg_temp.u(5) AND month = '2026-10-01'), 'S5 suspected_duplicate flag');
SELECT pg_temp.eq(pg_temp.cat(6, '2026-10-01'), 'B', 'S6 manual payment may already cover the credit → whole row B');
SELECT pg_temp.check(pg_temp.has_reason(6, '2026-10-01', 'MANUAL_PAYMENT_SAME_MONTH'), 'S6 reason MANUAL_PAYMENT_SAME_MONTH');
SELECT pg_temp.eq(pg_temp.cat(7, '2026-10-01'), 'B', 'S7 historical amount differs from current → B');
SELECT pg_temp.check(pg_temp.has_reason(7, '2026-10-01', 'AMOUNT_CHANGED'), 'S7 reason AMOUNT_CHANGED');
SELECT pg_temp.eq(pg_temp.cat(8, '2026-09-01'), 'B', 'S8 מרכז הצדקה never credited → B');
SELECT pg_temp.check(pg_temp.has_reason(8, '2026-09-01', 'RANK_NOT_IN_OLD_FUNCTION'), 'S8 reason RANK_NOT_IN_OLD_FUNCTION');
SELECT pg_temp.eq(pg_temp.cat(9, '2026-08-01'), 'B', 'S9 א"א credited by legacy function → B');
SELECT pg_temp.check(pg_temp.has_reason(9, '2026-08-01', 'CREDIT_RANK_NOT_APPROVED'), 'S9 reason CREDIT_RANK_NOT_APPROVED');
SELECT pg_temp.eq(pg_temp.cat(11, '2026-08-01'), 'B', 'S11 orphan charge → B');
SELECT pg_temp.check(pg_temp.has_reason(11, '2026-08-01', 'ORPHAN'), 'S11 reason ORPHAN');
SELECT pg_temp.eq(pg_temp.cat(16, '2026-10-01'), 'B', 'S16 graduated → B');
SELECT pg_temp.check(pg_temp.has_reason(16, '2026-10-01', 'GRADUATED'), 'S16 reason GRADUATED');
SELECT pg_temp.eq(pg_temp.cat(17, '2026-10-01'), 'B', 'S17 no start date & no history → B');
SELECT pg_temp.check(pg_temp.has_reason(17, '2026-10-01', 'NO_HISTORICAL_EVIDENCE'), 'S17 reason NO_HISTORICAL_EVIDENCE');
SELECT pg_temp.eq(pg_temp.cat(19, '2026-08-01'), 'B', 'S19 Aug: only next-month evidence → B (not A)');
SELECT pg_temp.check(pg_temp.has_reason(19, '2026-08-01', 'NO_PRIOR_MONTH_CHARGE'), 'S19 reason NO_PRIOR_MONTH_CHARGE');
SELECT pg_temp.eq(pg_temp.cat(20, '2026-10-01'), 'B', 'S20 unparseable tuition surfaces as B');
-- C: nothing to do
SELECT pg_temp.eq(pg_temp.cat(13, '2026-10-01'), 'C', 'S13 starts in Nov → C');
SELECT pg_temp.eq((SELECT string_agg(DISTINCT category, '') FROM recon_result WHERE student_id = pg_temp.u(14)), 'C', 'S14 complete + positive adjustment → C');
SELECT pg_temp.eq(pg_temp.cat(15, '2026-10-01'), 'C', 'S15 cancelled auto charge respected → C');
SELECT pg_temp.eq((SELECT string_agg(DISTINCT category, '') FROM recon_result WHERE student_id = pg_temp.u(18)), 'C', 'S18 complete קירוב לבבות → C');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM recon_result WHERE student_id = pg_temp.u(21)), 'S21 tuition 0, no tx → not billed, not reported');

-- plan contains ONLY category A rows, exact amounts, no currency mixing
SELECT pg_temp.eq((SELECT count(*) FROM recon_plan)::int, 8, 'plan rows = 8');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM recon_plan p JOIN recon_result r ON r.student_id = p.student_id AND r.month = p.billing_month
       WHERE r.category <> 'A'), 'plan never contains B/C rows');
SELECT pg_temp.eq((SELECT sum(amount) FROM recon_plan WHERE currency='ILS' AND transaction_type='monthly_charge'), -4500.00, 'ILS charges -4500');
SELECT pg_temp.eq((SELECT sum(amount) FROM recon_plan WHERE currency='USD' AND transaction_type='monthly_charge'), -400.00, 'USD charges -400');
SELECT pg_temp.eq((SELECT sum(amount) FROM recon_plan WHERE currency='ILS' AND transaction_type='automatic_payment'), 2500.00, 'ILS credits +2500');
SELECT pg_temp.eq((SELECT sum(amount) FROM recon_plan WHERE currency='USD' AND transaction_type='automatic_payment'), 400.00, 'USD credits +400');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM recon_plan WHERE student_id IN (pg_temp.u(3), pg_temp.u(4), pg_temp.u(6))),
       'no charge created where a manual charge/payment may replace it (no double debt)');
SELECT pg_temp.check(bool_and(CASE transaction_type WHEN 'monthly_charge' THEN transaction_date = billing_month + 19
                                                    ELSE transaction_date = billing_month + 20 END), 'plan dates 20/21') FROM recon_plan;

-- start-date restore proposal
SELECT pg_temp.eq((SELECT string_agg(right(student_id::text, 2), ',' ORDER BY student_id) FROM recon_start_date WHERE category = 'A'),
       '01,02,03,04,06,07,10', 'start date A: wiped students first charged Aug 2026');
SELECT pg_temp.check(bool_and(proposed_start_date = date '2026-08-20'), 'proposed date 2026-08-20') FROM recon_start_date WHERE category = 'A';
SELECT pg_temp.eq((SELECT string_agg(right(student_id::text, 2), ',' ORDER BY student_id) FROM recon_start_date WHERE category = 'B'),
       '17,19', 'start date B: first charged later / never charged');

-- the read-only report and summary files run cleanly
\o /dev/null
\i supabase/recovery/01_reconciliation_report.sql
\i supabase/recovery/02_reconciliation_summary.sql
\i supabase/recovery/03_start_date_restore_preview.sql
\o
SELECT pg_temp.eq((SELECT count(*) FROM tuition_transactions)::int, (SELECT count(*) FROM recon_tx)::int, 'read-only files changed nothing');
