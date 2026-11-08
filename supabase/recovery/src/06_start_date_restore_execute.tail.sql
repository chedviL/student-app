DO $$
DECLARE a start_date_approval; v_hash text; v_rows integer;
BEGIN
  SELECT * INTO a FROM start_date_approval;
  IF a.approved_by = '' THEN RAISE EXCEPTION 'approval block not filled — aborting'; END IF;
  SELECT md5(coalesce(string_agg(student_id::text || '|' || proposed_start_date::text, ',' ORDER BY student_id), '')),
         count(*)
    INTO v_hash, v_rows
    FROM recon_start_date WHERE category = 'A';
  IF v_rows = 0 THEN
    RAISE NOTICE 'nothing to restore (already done?)';
  ELSIF v_hash <> a.approved_hash OR v_rows <> a.approved_rows THEN
    RAISE EXCEPTION 'restore list differs from approved preview (hash % rows %) — aborting', v_hash, v_rows;
  END IF;
END $$;

DROP TABLE IF EXISTS pg_temp.start_date_restored;
CREATE TEMP TABLE start_date_restored AS
WITH upd AS (
  UPDATE public.students s
     SET tuition_start_date = r.proposed_start_date
    FROM recon_start_date r
   WHERE r.category = 'A' AND s.id = r.student_id AND s.tuition_start_date IS NULL
  RETURNING s.id, s.tuition_start_date
)
SELECT * FROM upd;

DO $$
BEGIN
  IF (SELECT count(*) FROM start_date_restored) <> (SELECT count(*) FROM recon_start_date WHERE category = 'A') THEN
    RAISE EXCEPTION 'restored count differs from plan — ROLLBACK';
  END IF;
END $$;

COMMIT;

SELECT r.id AS student_id, r.tuition_start_date AS restored_start_date FROM start_date_restored r ORDER BY 1;
