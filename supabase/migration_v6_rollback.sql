-- ============================================================
-- ROLLBACK for migration_v6_students_rls.sql
-- ⛔ Restores the previous (INSECURE) state exactly as captured from production
-- on 2026-11-08. Use only if v6 breaks the secretaries' work, and only with
-- explicit approval. Changes no data.
-- ============================================================
BEGIN;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow insert" ON public.students;
DROP POLICY IF EXISTS "allow anon insert" ON public.students;
CREATE POLICY "allow anon insert" ON public.students AS PERMISSIVE FOR INSERT TO anon WITH CHECK (true);
GRANT ALL ON public.students TO anon;
GRANT ALL ON public.alumni   TO anon;
GRANT SELECT, REFERENCES, TRIGGER, TRUNCATE ON public.tuition_transactions TO anon;
GRANT ALL ON public.tuition_balances, public.tuition_monthly_history TO anon;
DO $$ BEGIN
  IF to_regclass('public.tuition_transactions_with_users') IS NOT NULL THEN
    EXECUTE 'GRANT ALL ON public.tuition_transactions_with_users TO anon';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.increment_student_ages() TO PUBLIC, anon, authenticated;
COMMIT;
