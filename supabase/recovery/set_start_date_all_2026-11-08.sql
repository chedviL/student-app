-- קביעת תאריך תחילת גבייה אחיד 20.08.2026 לכל התלמידים שהתאריך שלהם ריק (95 נכון ל-08.11.2026)
BEGIN;
DO $$
DECLARE
  n_null_before integer;
  n_updated     integer;
BEGIN
  SELECT count(*) INTO n_null_before FROM public.students WHERE tuition_start_date IS NULL;
  IF n_null_before <> 95 THEN
    RAISE EXCEPTION 'expected 95 students without a start date, found % — data changed, nothing done', n_null_before;
  END IF;
  IF EXISTS (SELECT 1 FROM public.students WHERE tuition_start_date IS NOT NULL AND tuition_start_date <> DATE '2026-08-20') THEN
    RAISE EXCEPTION 'a start date other than 2026-08-20 exists — nothing done';
  END IF;
  UPDATE public.students SET tuition_start_date = DATE '2026-08-20' WHERE tuition_start_date IS NULL;
  GET DIAGNOSTICS n_updated = ROW_COUNT;
  IF n_updated <> 95 OR EXISTS (SELECT 1 FROM public.students WHERE tuition_start_date IS DISTINCT FROM DATE '2026-08-20') THEN
    RAISE EXCEPTION 'unexpected result (updated %) — rolled back', n_updated;
  END IF;
  RAISE NOTICE 'updated: %, every student now has 2026-08-20', n_updated;
END $$;
COMMIT;
