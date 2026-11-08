-- ============================================================
-- MIGRATION v6: CLOSE ANONYMOUS ACCESS TO students  (security)
-- ============================================================
-- ⚠️  Not approved for production yet. Do not run without explicit approval.
--
-- Finding (verified 2026-11-08, read-only):
--   students: RLS DISABLED + anon has SELECT/INSERT/UPDATE/DELETE.
--   With only the public anon key (embedded in the website), anyone could
--   read, change or delete every student record. Existing policies were not
--   enforced because RLS was off. Transactions/alumni/profiles were protected.
--
-- What this does:
--   1. Adds the missing INSERT policy for logged-in users (production has
--      read/update/delete policies for authenticated but NO insert policy —
--      enabling RLS without it would break "add student" for the secretaries).
--   2. Removes the "allow anon insert" policy.
--   3. Enables RLS on students.
--   4. Revokes all anon privileges on students and alumni, and anon SELECT on the
--      tuition table/views (defense in depth; RLS already returned 0 rows to anon).
--   5. Revokes EXECUTE on increment_student_ages() from PUBLIC/anon/authenticated
--      (SECURITY DEFINER; the app never calls it; cron runs as postgres).
--
-- Not affected: logged-in users (secretaries) keep exactly the same access
-- (same policies: auth.role() = 'authenticated'); the AI assistant forwards the
-- user's JWT; no data is changed.
-- Side effect: import-students.html (local tool using the anon key) must log in
-- before importing.
-- Rollback: supabase/migration_v6_rollback.sql
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "allow insert" ON public.students;
CREATE POLICY "allow insert"
  ON public.students FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "allow anon insert" ON public.students;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.students FROM anon;
REVOKE ALL ON public.alumni   FROM anon;
REVOKE ALL ON public.tuition_transactions FROM anon;
REVOKE ALL ON public.tuition_balances, public.tuition_monthly_history FROM anon;
DO $$ BEGIN
  IF to_regclass('public.tuition_transactions_with_users') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.tuition_transactions_with_users FROM anon';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.increment_student_ages() FROM PUBLIC, anon, authenticated;

-- Self-check inside the transaction: abort if the result is not as intended.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.students'::regclass) THEN
    RAISE EXCEPTION 'RLS not enabled on students';
  END IF;
  IF has_table_privilege('anon', 'public.students', 'SELECT')
     OR has_table_privilege('anon', 'public.students', 'UPDATE') THEN
    RAISE EXCEPTION 'anon still has privileges on students';
  END IF;
  IF (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students'
        AND cmd IN ('SELECT','INSERT','UPDATE','DELETE')
        AND qual IS DISTINCT FROM 'false' ) < 4 THEN
    RAISE EXCEPTION 'expected read/insert/update/delete policies for authenticated on students';
  END IF;
END $$;

COMMIT;
