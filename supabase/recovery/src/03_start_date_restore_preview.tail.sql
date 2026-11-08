-- ── START-DATE RESTORE PREVIEW (nothing is changed) ──
-- Copy approval_hash_for_A / rows_A into 06_start_date_restore_execute.sql.
WITH h AS (
  SELECT md5(coalesce(string_agg(student_id::text || '|' || proposed_start_date::text, ','
                                 ORDER BY student_id), '')) AS approval_hash_for_A,
         count(*) AS rows_A
  FROM recon_start_date WHERE category = 'A'
)
SELECT s.category, s.name, s.class_name, s.passport_or_id, s.student_id,
       s.cur_tuition_raw, s.cur_currency, s.cur_rank,
       s.first_auto_charge_month, s.last_auto_charge_month, s.proposed_start_date,
       s.evidence, s.updated_at AS last_student_update,
       h.approval_hash_for_A, h.rows_A
FROM recon_start_date s CROSS JOIN h
UNION ALL
SELECT NULL, '(no students with missing start date)', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       NULL, NULL, h.approval_hash_for_A, h.rows_A
FROM h WHERE NOT EXISTS (SELECT 1 FROM recon_start_date)
ORDER BY 1, 10 DESC NULLS LAST, 2;
