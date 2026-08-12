-- ============================================================
-- TUITION DIAGNOSTICS v2
-- c:\Users\...\student-app\supabase\tuition_diagnostics.sql
--
-- SELECT queries ONLY — no data is changed.
-- Run each query separately in the Supabase SQL Editor.
-- ============================================================

-- ── DIAG-1: tuition_rank — exact values ─────────────────────────────────────
-- Confirm the exact strings for automatic payment methods.
-- Update process_monthly_tuition if values differ from 'אשראי','בנקאי','א"א'.

select
  tuition_rank,
  count(*) as student_count
from students
where tuition_rank is not null and tuition_rank != ''
group by tuition_rank
order by tuition_rank;

-- ── DIAG-2: tuition — non-numeric or empty values ───────────────────────────
-- Students who will be SKIPPED by the charge function.
-- Includes cases like "500 יש חוב קטן" or "7000 מראש" — shown as anomalies.

select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  case
    when tuition is null or tuition = ''          then 'empty'
    when tuition ~ '^[0-9]+(\.[0-9]+)?$'
         and tuition::numeric > 0                 then 'valid → ' || tuition::numeric
    else                                               'ANOMALY — will be skipped: ' || tuition
  end as diagnosis
from students
where
  tuition is null
  or tuition = ''
  or not (tuition ~ '^[0-9]+(\.[0-9]+)?$' and tuition::numeric > 0)
order by last_name;

-- ── DIAG-3: tuition_currency — all raw values ───────────────────────────────
-- Shows every distinct value currently in the column (may include ₪, $, NULL, etc.)

select
  coalesce(tuition_currency, '(NULL)') as tuition_currency,
  count(*) as student_count
from students
group by tuition_currency
order by tuition_currency;

-- ── DIAG-4: tuition_currency — students missing or invalid currency ──────────
-- These students will be skipped by the charge function until fixed.

select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  coalesce(tuition_currency, '(NULL)') as tuition_currency
from students
where tuition_currency is null
   or tuition_currency not in ('ILS', 'USD')
order by last_name;

-- ── DIAG-5: tuition_start_date vs due_date_note — side by side ──────────────
-- The import tool previously mapped 'תאריך תחילת גביית שכ"ל' → due_date_note.
-- tuition_start_date is empty for all existing students.
-- This query shows both fields to help decide on backfill strategy.

select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  coalesce(tuition_start_date, '(NULL)') as tuition_start_date,
  coalesce(due_date_note,      '(NULL)') as due_date_note,
  case
    when tuition_start_date is null or tuition_start_date = '' then 'start_date: empty'
    when tuition_start_date ~ '^\d{4}-\d{2}-\d{2}$'          then 'start_date: YYYY-MM-DD → ' || tuition_start_date::date::text
    when tuition_start_date ~ '^\d{1,2}\.\d{1,2}\.\d{4}$'    then 'start_date: DD.MM.YYYY → ' || to_date(tuition_start_date, 'DD.MM.YYYY')::text
    else                                                            'start_date: UNPARSEABLE → ' || tuition_start_date
  end as start_date_diagnosis,
  case
    when due_date_note is null or due_date_note = ''           then 'due_date: empty'
    when due_date_note ~ '^\d{5}$'                            then 'due_date: Excel serial → ' ||
         (date '1899-12-30' + due_date_note::integer)::text
    when due_date_note ~ '^\d{4}-\d{2}-\d{2}$'               then 'due_date: YYYY-MM-DD → ' || due_date_note::date::text
    when due_date_note ~ '^\d{1,2}\.\d{1,2}\.\d{4}$'         then 'due_date: DD.MM.YYYY → ' || to_date(due_date_note, 'DD.MM.YYYY')::text
    when due_date_note ~ '^\d{1,2}/\d{1,2}/\d{2,4}$'         then 'due_date: DD/MM/YY(YY) — needs manual review'
    else                                                            'due_date: text/note → ' || due_date_note
  end as due_date_diagnosis
from students
order by last_name;

-- ── DIAG-6: students eligible for automatic charge (all conditions met) ──────
-- Run this AFTER fixing currency and tuition_start_date.
-- Shows exactly who will be charged when the function runs.

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
  and tuition_start_date != ''
  and (
    tuition_start_date ~ '^\d{4}-\d{2}-\d{2}$'
    or tuition_start_date ~ '^\d{1,2}\.\d{1,2}\.\d{4}$'
  )
order by last_name;

-- ── DIAG-7: Excel serial date PREVIEW — proposed tuition_start_date ─────────
-- Shows students where due_date_note is a 5-digit Excel serial number.
-- Converts it to a real date for review. NO data is changed.
-- Example: 45920 → 2025-09-20
-- Review this list and confirm dates look correct before any backfill.

select
  id                                                          as student_id,
  passport_or_id,
  last_name || ' ' || coalesce(first_name, '')               as student_name,
  due_date_note                                              as excel_serial,
  (date '1899-12-30' + due_date_note::integer)::text         as proposed_tuition_start_date
from students
where
  due_date_note ~ '^\d{5}$'
  and due_date_note::integer between 40000 and 50000
  -- range 40000–50000 covers roughly 2009–2036, filters out non-date numbers
order by last_name;

-- ── DIAG-8: students with tuition > 0 but NO start date anywhere ────────────
-- These students have a tuition amount but no usable start date in either field.
-- They will NOT be charged automatically until a start date is set manually.

select
  passport_or_id,
  last_name,
  first_name,
  tuition,
  tuition_currency,
  coalesce(tuition_start_date, '(NULL)') as tuition_start_date,
  coalesce(due_date_note,      '(NULL)') as due_date_note
from students
where
  tuition is not null
  and tuition ~ '^[0-9]+(\.[0-9]+)?$'
  and tuition::numeric > 0
  and (tuition_start_date is null or tuition_start_date = '')
  and (due_date_note      is null or due_date_note      = '')
order by last_name;

-- ── DIAG-9: tuition anomalies — non-numeric tuition values (full list) ───────
-- Shows every student whose tuition field is not a clean number.
-- Includes cases like "500 יש חוב קטן", "7000 מראש", free text, etc.
-- Review each row and decide manually: what is the real amount, what is the note.

select
  passport_or_id,
  last_name,
  first_name,
  tuition as raw_tuition_value
from students
where
  tuition is not null
  and tuition != ''
  and not (tuition ~ '^[0-9]+(\.[0-9]+)?$' and tuition::numeric > 0)
order by last_name;

-- ── QUICK-CHECK A: distinct tuition_rank values + count ─────────────────────

select
  coalesce(tuition_rank, '(NULL)') as tuition_rank,
  count(*) as student_count
from students
group by tuition_rank
order by student_count desc;

-- ── QUICK-CHECK B: distinct tuition_currency values + count ─────────────────

select
  coalesce(tuition_currency, '(NULL)') as tuition_currency,
  count(*) as student_count
from students
group by tuition_currency
order by student_count desc;

-- ── DIAG-10: students with tuition > 0 AND tuition_currency IS NULL ──────────
-- These are students who actually pay tuition but have no currency set.
-- They will be SKIPPED by process_monthly_tuition until currency is filled.
-- Fix: update tuition_currency manually or via import tool before running cron.

select
  passport_or_id,
  first_name,
  last_name,
  tuition,
  tuition_rank,
  coalesce(tuition_start_date, '(NULL)') as tuition_start_date
from students
where
  tuition is not null
  and tuition ~ '^[0-9]+(\.[0-9]+)?$'
  and tuition::numeric > 0
  and tuition_currency is null
order by last_name, first_name;

-- ── DIAG-11: tuition_start_date — validate all non-empty values before ALTER ──
-- Run this BEFORE running the migration.
-- Expected result: zero rows in the "NOT ISO" section.
-- If any rows appear there, DO NOT run the ALTER TABLE in the migration.

-- Part A: summary by format
select
  case
    when tuition_start_date is null or tuition_start_date = ''
                                                     then 'empty / NULL'
    when tuition_start_date ~ '^\d{4}-\d{2}-\d{2}$' then 'ISO YYYY-MM-DD ✔'
    else                                                  'NOT ISO ✘ — BLOCKS MIGRATION'
  end as format_diagnosis,
  count(*) as student_count
from students
group by 1
order by 1;

-- Part B: list every non-empty, non-ISO value (should return 0 rows if safe)
select
  passport_or_id,
  last_name,
  first_name,
  tuition_start_date as bad_value
from students
where
  tuition_start_date is not null
  and tuition_start_date != ''
  and tuition_start_date !~ '^\d{4}-\d{2}-\d{2}$'
order by last_name;
