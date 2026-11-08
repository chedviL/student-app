-- ⛔ PRODUCTION WRITE SCRIPT — RUN ONLY AFTER EXPLICIT WRITTEN APPROVAL ⛔
-- Restores tuition_start_date ONLY for category-A students of
-- 03_start_date_restore_preview.sql, and ONLY where the value is still NULL.
-- Must run BEFORE the next cron (21st), otherwise these students are skipped again.
-- With migration v5 applied, every change is recorded in student_tuition_audit.
--
-- Rollback (requires approval): the old value was NULL for every row changed here;
--   UPDATE public.students SET tuition_start_date = NULL
--    WHERE id IN (SELECT student_id FROM public.student_tuition_audit
--                 WHERE field = 'tuition_start_date' AND old_value IS NULL
--                   AND changed_at >= '<execution timestamp>');

-- ┌──────────────── APPROVAL BLOCK — EDIT HERE ────────────────┐
DROP TABLE IF EXISTS pg_temp.start_date_approval;
CREATE TEMP TABLE start_date_approval AS SELECT
  ''::text     AS approved_by,     -- full name of the approver
  ''::text     AS approved_hash,   -- approval_hash_for_A from 03_start_date_restore_preview.sql
  -1::integer  AS approved_rows;   -- rows_A from 03_start_date_restore_preview.sql
-- └────────────────────────────────────────────────────────────┘

BEGIN;
LOCK TABLE public.students IN SHARE ROW EXCLUSIVE MODE;
