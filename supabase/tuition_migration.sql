-- ============================================================
-- TUITION MANAGEMENT SYSTEM — MIGRATION v3
-- Run in Supabase SQL Editor
-- DO NOT RUN until all DIAG queries have been reviewed.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- SECTION 0 — DIAGNOSTIC QUERIES
-- Run each one separately BEFORE running the migration.
-- Remove the surrounding /* */ to execute.
-- ════════════════════════════════════════════════════════════

-- ── DIAG-1: tuition_rank — exact values in the database ─────────────────────
-- Purpose: confirm the exact strings used for automatic payment methods.
-- Update the process_monthly_tuition function if values differ from
-- 'אשראי', 'בנקאי', 'א"א'.
/*
select
  tuition_rank,
  count(*) as student_count
from students
where tuition_rank is not null and tuition_rank != ''
group by tuition_rank
order by tuition_rank;
*/

-- ── DIAG-2: tuition — find all non-numeric or empty values ──────────────────
-- Purpose: identify students who will be skipped by the charge function.
/*
select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  case
    when tuition is null or tuition = ''            then 'empty'
    when tuition ~ '^[0-9]+(\.[0-9]+)?$'
         and tuition::numeric > 0                   then 'valid → ' || tuition::numeric
    else                                                 'INVALID — will be skipped'
  end as diagnosis
from students
where
  tuition is null
  or tuition = ''
  or not (tuition ~ '^[0-9]+(\.[0-9]+)?$' and tuition::numeric > 0)
order by last_name;
*/

-- ── DIAG-3: tuition_currency — raw values as imported ───────────────────────
-- Purpose: the Excel column '$/₪' may contain '₪', '$', 'ILS', 'USD', or other.
-- The normalization in Section 1 handles ₪→ILS and $→USD.
-- Any other value will remain as-is and will be caught by DIAG-4.
/*
select
  tuition_currency,
  count(*) as student_count
from students
group by tuition_currency
order by tuition_currency;
*/

-- ── DIAG-4: tuition_currency — students with missing or invalid currency ─────
-- Purpose: these students will be skipped by the charge function until fixed.
-- After running DIAG-3 and the normalization update in Section 1,
-- re-run this query to confirm no students remain with invalid currency.
/*
select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  tuition_currency
from students
where tuition_currency is null
   or tuition_currency not in ('ILS', 'USD')
order by last_name;
*/

-- ── DIAG-5: tuition_start_date vs due_date_note ──────────────────────────────
-- Purpose: the import tool maps 'תאריך תחילת גביית שכ"ל' → tuition_start_date (date).
-- After migration, tuition_start_date is type date — no text parsing needed.
/*
select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  tuition_start_date,
  due_date_note
from students
order by last_name;
*/

-- ── DIAG-6: students eligible for automatic charge (all conditions met) ──────
-- Purpose: final check — shows exactly who will be charged when function runs.
-- After migration tuition_start_date is type date — no text pattern needed.
-- Run this AFTER fixing currency and start dates.
/*
select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  tuition_rank,
  tuition_currency,
  tuition_start_date
from students
where
  tuition is not null
  and tuition ~ '^[0-9]+(\.[0-9]+)?$'
  and tuition::numeric > 0
  and tuition_currency in ('ILS', 'USD')
  and tuition_start_date is not null
order by last_name;
*/

-- ════════════════════════════════════════════════════════════
-- SECTION 1 — ADD tuition_currency TO students (nullable)
-- ════════════════════════════════════════════════════════════

-- Added as NULLABLE — we never assume a currency for existing students.
-- The import tool maps Excel column '$/₪' → tuition_currency.
-- Possible raw values from Excel: '₪', '$', 'ILS', 'USD', or empty/null.
-- The UPDATE below normalizes ₪→ILS and $→USD safely.
-- Students with NULL or unrecognized currency are skipped by the charge function.

-- Actual values found in DB (from DIAG-3 run):
--   NULL = 244  |  '$' = 32  |  'ש"ח' = 17
-- Normalization map:
--   '$'   → 'USD'   |  'USD' → 'USD'
--   'ש"ח' → 'ILS'   |  '₪'  → 'ILS'  |  'ILS' → 'ILS'
-- Unknown values are left unchanged (not forced to NULL) so they appear in DIAG-4.

alter table students
  add column if not exists tuition_currency text;
-- No check constraint — unknown values must remain visible for diagnostics.
-- A constraint will be added in a future migration once all values are clean.

-- Normalize known currency symbols to ISO codes (safe UPDATE — only touches this column)
update students
set tuition_currency = case
  when trim(tuition_currency) in ('ש"ח', '₪', 'ILS') then 'ILS'
  when trim(tuition_currency) in ('$', 'USD')         then 'USD'
  else tuition_currency  -- unknown value: leave as-is, will surface in DIAG-4
end
where tuition_currency is not null
  and trim(tuition_currency) not in ('ILS', 'USD');  -- skip already-normalized rows

-- ════════════════════════════════════════════════════════════
-- SECTION 1b — CONVERT tuition_start_date FROM text TO date
-- ════════════════════════════════════════════════════════════

-- PREREQUISITE: Run DIAG-11 first and confirm Part B returns 0 rows.
-- If any non-ISO values exist, fix them before running this section.
--
-- Steps:
--   1. Empty strings → NULL (ALTER TABLE cannot cast '' to date)
--   2. ALTER COLUMN type to date using USING clause (ISO cast is safe)
--   3. Result: NULL for missing dates, real date for populated ones

-- Step 1: empty strings → NULL
update students
set tuition_start_date = null
where tuition_start_date = '';

-- Step 2: convert column type
alter table students
  alter column tuition_start_date type date
  using tuition_start_date::date;

-- ════════════════════════════════════════════════════════════
-- SECTION 2 — tuition_transactions TABLE
-- ════════════════════════════════════════════════════════════

-- student_id design decision:
--
-- graduateStudent() in alumniApi.ts does:
--   1. INSERT INTO alumni (..., id = students.id, ...)  ← same UUID is preserved
--   2. DELETE FROM students WHERE id = student_id
--
-- Because alumni.id = students.id (same UUID), we can always look up a
-- graduated student's name/details in the alumni table using student_id.
--
-- Therefore:
--   - student_id is uuid NOT NULL — the UUID is never lost
--   - NO foreign key to students — a FK would break on DELETE (graduation)
--   - NO ON DELETE CASCADE — would destroy transaction history
--   - NO ON DELETE SET NULL — would lose the UUID, breaking alumni lookup
--
-- To find a student's name for a transaction:
--   COALESCE(
--     (SELECT last_name || ' ' || first_name FROM students WHERE id = student_id),
--     (SELECT last_name || ' ' || first_name FROM alumni   WHERE id = student_id)
--   )

create table if not exists tuition_transactions (
  id               uuid        primary key default gen_random_uuid(),
  student_id       uuid        not null,   -- no FK — preserved through graduation
  billing_month    date        not null,   -- always first of month: 2026-08-01
  transaction_date date        not null default current_date,
  amount           numeric(12,2) not null, -- negative = charge, positive = payment
  currency         text        not null check (currency in ('ILS', 'USD')),
  transaction_type text        not null check (transaction_type in (
                                 'monthly_charge', 'automatic_payment',
                                 'manual_payment', 'manual_charge', 'adjustment')),
  source           text        not null check (source in ('automatic', 'manual')),
  note             text,
  created_at       timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════
-- SECTION 3 — INDEXES
-- ════════════════════════════════════════════════════════════

create index if not exists idx_tuition_txn_student
  on tuition_transactions(student_id);

create index if not exists idx_tuition_txn_billing_month
  on tuition_transactions(student_id, billing_month);

-- ════════════════════════════════════════════════════════════
-- SECTION 4 — DUPLICATE PROTECTION (partial unique indexes)
-- ════════════════════════════════════════════════════════════

-- Exactly one automatic monthly_charge per student per billing_month.
create unique index if not exists uq_auto_monthly_charge
  on tuition_transactions(student_id, billing_month)
  where transaction_type = 'monthly_charge' and source = 'automatic';

-- Exactly one automatic_payment per student per billing_month.
create unique index if not exists uq_auto_payment
  on tuition_transactions(student_id, billing_month)
  where transaction_type = 'automatic_payment' and source = 'automatic';

-- manual_payment, manual_charge, adjustment: no restriction — multiple allowed per month.

-- ════════════════════════════════════════════════════════════
-- SECTION 5 — RLS
-- ════════════════════════════════════════════════════════════

-- Matches the existing RLS model in policies.sql and alumni_schema.sql:
-- all authenticated users can read and write. No per-user row filtering.

alter table tuition_transactions enable row level security;

drop policy if exists "tuition_txn_select" on tuition_transactions;
drop policy if exists "tuition_txn_insert" on tuition_transactions;
drop policy if exists "tuition_txn_update" on tuition_transactions;
drop policy if exists "tuition_txn_delete" on tuition_transactions;

create policy "tuition_txn_select"
  on tuition_transactions for select
  using (auth.role() = 'authenticated');

create policy "tuition_txn_insert"
  on tuition_transactions for insert
  with check (auth.role() = 'authenticated');

create policy "tuition_txn_update"
  on tuition_transactions for update
  using (auth.role() = 'authenticated');

create policy "tuition_txn_delete"
  on tuition_transactions for delete
  using (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════════════════
-- SECTION 6 — CURRENT BALANCE VIEW
-- ════════════════════════════════════════════════════════════

-- Joins students to get the student's declared currency.
-- Only transactions whose currency matches the student's currency are summed.
-- ILS and USD are never combined.
-- Students with NULL tuition_currency return current_balance = 0, status = 'no_currency'.

create or replace view tuition_balances as
select
  s.id                                        as student_id,
  s.tuition_currency                          as currency,
  coalesce(sum(t.amount), 0)                  as current_balance,
  case
    when s.tuition_currency is null           then 'no_currency'
    when coalesce(sum(t.amount), 0) < 0       then 'debt'
    else                                           'ok'
  end                                         as status
from students s
left join tuition_transactions t
  on  t.student_id = s.id
  and t.currency   = s.tuition_currency
group by s.id, s.tuition_currency;

-- ════════════════════════════════════════════════════════════
-- SECTION 7 — MONTHLY HISTORY VIEW
-- ════════════════════════════════════════════════════════════

-- currency is explicit in GROUP BY — ILS and USD never mixed.
-- balance_after_month is cumulative per (student_id, currency), ordered by billing_month.
-- Student name lookup: checks students first, then alumni (same UUID after graduation).

create or replace view tuition_monthly_history as
select
  t.student_id,
  t.currency,
  t.billing_month,
  sum(t.amount) filter (where t.amount < 0)   as charges,
  sum(t.amount) filter (where t.amount > 0)   as credits,
  sum(t.amount)                               as monthly_total,
  sum(sum(t.amount)) over (
    partition by t.student_id, t.currency
    order by t.billing_month
    rows between unbounded preceding and current row
  )                                           as balance_after_month,
  coalesce(
    (select s.last_name || ' ' || coalesce(s.first_name, '')
     from students s where s.id = t.student_id),
    (select a.last_name || ' ' || coalesce(a.first_name, '')
     from alumni   a where a.id = t.student_id)
  )                                           as student_name
from tuition_transactions t
group by t.student_id, t.currency, t.billing_month;

-- ════════════════════════════════════════════════════════════
-- SECTION 8 — MONTHLY PROCESSING FUNCTION
-- ════════════════════════════════════════════════════════════

-- Eligibility — a student is charged only when ALL of these are true:
--   1. tuition is a positive number (numeric, no symbols)
--   2. tuition_currency is exactly 'ILS' or 'USD' (never NULL, never '₪'/'$')
--   3. tuition_start_date is non-empty and parseable (YYYY-MM-DD or DD.MM.YYYY)
--   4. tuition_start_date month <= billing_month
--
-- Automatic payment methods (trim applied — handles accidental whitespace):
--   'אשראי', 'בנקאי', 'א"א'
--   *** VERIFY with DIAG-1 before first run and update this list if needed ***
--
-- Idempotent: ON CONFLICT DO NOTHING on partial unique indexes.
-- Safe to run multiple times for the same month — no duplicates created.
--
-- student_id stored as-is (NOT NULL uuid, no FK).
-- After graduation, the same UUID exists in alumni — history is never lost.

create or replace function process_monthly_tuition(
  p_billing_month date default date_trunc('month', current_date)::date
)
returns table(
  processed_student_id uuid,
  student_name         text,
  action               text
)
language plpgsql
security definer
as $$
declare
  rec      record;
  v_amount numeric(12,2);
begin
  for rec in
    select
      id,
      coalesce(last_name, '') || ' ' || coalesce(first_name, '') as full_name,
      tuition,
      trim(tuition_rank)  as tuition_rank,
      tuition_currency,
      tuition_start_date  -- now type date, no parsing needed
    from students
    where
      tuition is not null
      and tuition ~ '^[0-9]+(\.[0-9]+)?$'
      and tuition::numeric > 0
      and tuition_currency in ('ILS', 'USD')
      and tuition_start_date is not null
      and date_trunc('month', tuition_start_date)::date <= p_billing_month
  loop
    v_amount := rec.tuition::numeric;

    -- monthly charge
    insert into tuition_transactions
      (student_id, billing_month, transaction_date, amount, currency,
       transaction_type, source, note)
    values
      (rec.id, p_billing_month, p_billing_month,
       -v_amount, rec.tuition_currency,
       'monthly_charge', 'automatic', 'חיוב שכ"ל חודשי אוטומטי')
    on conflict do nothing;

    processed_student_id := rec.id;
    student_name         := rec.full_name;
    action               := 'charged';
    return next;

    -- automatic payment
    if rec.tuition_rank in ('אשראי', 'בנקאי', 'א"א') then
      insert into tuition_transactions
        (student_id, billing_month, transaction_date, amount, currency,
         transaction_type, source, note)
      values
        (rec.id, p_billing_month, p_billing_month,
         v_amount, rec.tuition_currency,
         'automatic_payment', 'automatic', 'תשלום אוטומטי — ' || rec.tuition_rank)
      on conflict do nothing;

      processed_student_id := rec.id;
      student_name         := rec.full_name;
      action               := 'charged_and_paid';
      return next;
    end if;

  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════
-- SECTION 9 — CRON JOB (DISABLED)
-- ════════════════════════════════════════════════════════════

-- Do NOT activate until:
--   ✓ DIAG-1 run and tuition_rank values confirmed in function above
--   ✓ DIAG-4 run and all students have valid tuition_currency
--   ✓ DIAG-5 run and tuition_start_date populated correctly
--   ✓ DIAG-6 run and eligible student list looks correct
--   ✓ Manual test: select * from process_monthly_tuition('YYYY-MM-01')
--   ✓ Idempotency test: run twice, confirm no duplicate rows
--
-- To activate (after enabling pg_cron in Supabase Dashboard → Extensions):
--
-- select cron.schedule(
--   'monthly-tuition-processing',
--   '0 6 1 * *',
--   $$select process_monthly_tuition()$$
-- );
--
-- To change schedule or disable:
--   select cron.unschedule('monthly-tuition-processing');

-- ════════════════════════════════════════════════════════════
-- SECTION 10 — FUTURE: tuition_start_date BACKFILL PLAN
-- ════════════════════════════════════════════════════════════

-- The import tool maps 'תאריך תחילת גביית שכ"ל' → due_date_note (not tuition_start_date).
-- Run DIAG-5 to see what is actually in both fields.
--
-- If due_date_note reliably contains the start date, the backfill would be:
--
-- UPDATE students
-- SET tuition_start_date = <parsed due_date_note>
-- WHERE tuition_start_date IS NULL OR tuition_start_date = ''
--   AND due_date_note ~ '<parseable pattern>';
--
-- DO NOT run this until DIAG-5 results are reviewed.
-- DO NOT delete due_date_note — it may contain other notes beyond just the date.

-- ════════════════════════════════════════════════════════════
-- SECTION 11 — HISTORICAL BACKFILL (NOT IMPLEMENTED)
-- ════════════════════════════════════════════════════════════

-- Not included. Creating historical charges without historical payments
-- would produce incorrect debt balances.
-- Plan separately: decide on cutover date and/or opening balance transactions.
