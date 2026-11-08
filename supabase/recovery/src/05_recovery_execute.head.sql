-- ⛔ PRODUCTION WRITE SCRIPT — RUN ONLY AFTER EXPLICIT WRITTEN APPROVAL ⛔
--
-- Prerequisites (each is checked below; any failure → full ROLLBACK, nothing written):
--   1. Verified, restorable backup exists (Supabase PITR / daily backup) — checked by a human.
--   2. migration_v5_tuition_integrity.sql applied (tuition_recovery_log exists).
--   3. 04_recovery_plan_preview.sql was run and its plan_hash / plan_rows were APPROVED.
--   4. Fill the approval block below.
--
-- Guarantees:
--   • Inserts ONLY category-A rows; never updates or deletes an existing transaction.
--   • Writes exactly the approved plan: the plan is recomputed under a table lock and
--     its hash must equal the approved hash, otherwise nothing is written.
--   • Idempotent: after a successful run the plan is empty; re-running with the same
--     batch_id writes nothing (and says so).
--   • Every inserted row is logged in tuition_recovery_log with its evidence.
--   • Snapshot of tuition_transactions is kept in schema recovery_backup (not exposed by the API).
--
-- Rollback of a committed batch (requires separate approval):
--   UPDATE public.tuition_transactions t
--      SET cancelled_at = now(), cancellation_reason = 'ביטול שחזור batch <BATCH_ID>'
--    WHERE t.id IN (SELECT transaction_id FROM public.tuition_recovery_log WHERE batch_id = '<BATCH_ID>')
--      AND t.cancelled_at IS NULL;
--   (cancellation keeps history; the snapshot table allows a full comparison.)

-- ┌──────────────── APPROVAL BLOCK — EDIT HERE ────────────────┐
DROP TABLE IF EXISTS pg_temp.recovery_approval;
CREATE TEMP TABLE recovery_approval AS SELECT
  'RECOVERY-2026-08-10'::text  AS batch_id,
  ''::text                     AS approved_by,        -- full name of the approver
  ''::text                     AS approved_plan_hash, -- plan_hash from 04_recovery_plan_preview.sql
  -1::integer                  AS approved_plan_rows; -- plan_rows from 04_recovery_plan_preview.sql
-- └────────────────────────────────────────────────────────────┘

BEGIN;

-- Freeze transaction writes for the few seconds of the recovery so the plan
-- cannot change between computation and insert (reads stay allowed).
LOCK TABLE public.tuition_transactions IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regclass('public.tuition_recovery_log') IS NULL THEN
    RAISE EXCEPTION 'migration v5 not applied (tuition_recovery_log missing) — aborting';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_auto_monthly_charge')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_auto_payment') THEN
    RAISE EXCEPTION 'unique indexes uq_auto_monthly_charge / uq_auto_payment missing — aborting';
  END IF;
  IF (SELECT approved_by FROM recovery_approval) = '' THEN
    RAISE EXCEPTION 'approval block not filled (approved_by) — aborting';
  END IF;
END $$;
