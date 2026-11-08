-- ── approval check ──
DROP TABLE IF EXISTS pg_temp.recovery_check;
CREATE TEMP TABLE recovery_check AS
SELECT
  md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', student_id, billing_month, transaction_type,
                                 amount, currency, transaction_date), ','
                          ORDER BY student_id, billing_month, transaction_type), '')) AS plan_hash,
  count(*)::integer AS plan_rows,
  EXISTS (SELECT 1 FROM public.tuition_recovery_log l, recovery_approval a WHERE l.batch_id = a.batch_id) AS batch_done
FROM recon_plan;

DO $$
DECLARE c recovery_check; a recovery_approval;
BEGIN
  SELECT * INTO c FROM recovery_check;
  SELECT * INTO a FROM recovery_approval;
  IF c.batch_done THEN
    IF c.plan_rows <> 0 THEN
      RAISE EXCEPTION 'batch % already executed but the plan is not empty (% rows) — new data appeared; run a new preview and approve a NEW batch_id', a.batch_id, c.plan_rows;
    END IF;
    RAISE NOTICE 'batch % already executed — nothing to do', a.batch_id;
  ELSE
    IF c.plan_hash <> a.approved_plan_hash OR c.plan_rows <> a.approved_plan_rows THEN
      RAISE EXCEPTION 'plan differs from the approved preview (hash % rows %, approved % rows %) — aborting, nothing written',
        c.plan_hash, c.plan_rows, a.approved_plan_hash, a.approved_plan_rows;
    END IF;
  END IF;
END $$;

-- ── snapshot (outside the exposed API schema) ──
CREATE SCHEMA IF NOT EXISTS recovery_backup;
REVOKE ALL ON SCHEMA recovery_backup FROM PUBLIC;
DO $$
DECLARE v_name text := 'tuition_transactions_' || lower(regexp_replace((SELECT batch_id FROM recovery_approval), '[^A-Za-z0-9]', '_', 'g'));
BEGIN
  IF to_regclass('recovery_backup.' || v_name) IS NULL THEN
    EXECUTE format('CREATE TABLE recovery_backup.%I AS SELECT * FROM public.tuition_transactions', v_name);
    EXECUTE format('REVOKE ALL ON recovery_backup.%I FROM PUBLIC', v_name);
  END IF;
END $$;

-- ── before totals ──
DROP TABLE IF EXISTS pg_temp.recovery_before;
CREATE TEMP TABLE recovery_before AS
SELECT currency, count(*) AS n, sum(amount) AS total
FROM public.tuition_transactions WHERE cancelled_at IS NULL GROUP BY currency;

-- ── insert + audit ──
DROP TABLE IF EXISTS pg_temp.recovery_inserted;
CREATE TEMP TABLE recovery_inserted (id uuid, student_id uuid, billing_month date, transaction_type text, amount numeric, currency text);

WITH ins AS (
  INSERT INTO public.tuition_transactions
    (student_id, billing_month, transaction_date, amount, currency, transaction_type, source, note)
  SELECT p.student_id, p.billing_month, p.transaction_date, p.amount, p.currency, p.transaction_type, 'automatic',
         CASE p.transaction_type WHEN 'monthly_charge' THEN 'חיוב שכ"ל חודשי — שחזור ' ELSE 'תשלום אוטומטי — שחזור ' END
           || (SELECT batch_id FROM recovery_approval)
  FROM recon_plan p
  WHERE NOT (SELECT batch_done FROM recovery_check)
  ON CONFLICT DO NOTHING
  RETURNING id, student_id, billing_month, transaction_type, amount, currency
)
INSERT INTO recovery_inserted SELECT * FROM ins;

INSERT INTO public.tuition_recovery_log
  (batch_id, transaction_id, student_id, billing_month, transaction_type, amount, currency, category, evidence, approved_by)
SELECT a.batch_id, i.id, i.student_id, i.billing_month, i.transaction_type, i.amount, i.currency, 'A', p.evidence, a.approved_by
FROM recovery_inserted i
JOIN recon_plan p USING (student_id, billing_month, transaction_type)
CROSS JOIN recovery_approval a;

-- ── post-conditions (any failure → ROLLBACK of everything above) ──
DO $$
DECLARE v_plan integer; v_ins integer; v_log integer; v_done boolean;
BEGIN
  SELECT plan_rows, batch_done INTO v_plan, v_done FROM recovery_check;
  SELECT count(*) INTO v_ins FROM recovery_inserted;
  SELECT count(*) INTO v_log FROM public.tuition_recovery_log l, recovery_approval a WHERE l.batch_id = a.batch_id;
  IF NOT v_done AND v_ins <> v_plan THEN
    RAISE EXCEPTION 'inserted % rows but plan has % (a conflicting row exists) — ROLLBACK', v_ins, v_plan;
  END IF;
  IF NOT v_done AND v_log <> v_ins THEN
    RAISE EXCEPTION 'audit rows % <> inserted % — ROLLBACK', v_log, v_ins;
  END IF;
  IF EXISTS (SELECT 1 FROM public.tuition_transactions WHERE cancelled_at IS NULL
               AND transaction_type IN ('monthly_charge','automatic_payment') AND source = 'automatic'
             GROUP BY student_id, billing_month, transaction_type HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'duplicate automatic rows detected after insert — ROLLBACK';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (SELECT currency, count(*) n, sum(amount) total FROM public.tuition_transactions
                   WHERE cancelled_at IS NULL GROUP BY currency) af
    FULL JOIN recovery_before b USING (currency)
    LEFT JOIN (SELECT currency, count(*) n, sum(amount) total FROM recovery_inserted GROUP BY currency) i USING (currency)
    WHERE coalesce(af.n, 0) <> coalesce(b.n, 0) + coalesce(i.n, 0)
       OR coalesce(af.total, 0) <> coalesce(b.total, 0) + coalesce(i.total, 0)
  ) THEN
    RAISE EXCEPTION 'before/after totals do not reconcile per currency — ROLLBACK';
  END IF;
END $$;

COMMIT;

-- ── result (read-only) ──
SELECT l.batch_id, l.billing_month, l.currency, l.transaction_type,
       count(*) AS rows, sum(l.amount) AS total, min(l.executed_at) AS executed_at, min(l.approved_by) AS approved_by
FROM public.tuition_recovery_log l
WHERE l.batch_id = (SELECT batch_id FROM recovery_approval)
GROUP BY l.batch_id, l.billing_month, l.currency, l.transaction_type
ORDER BY l.billing_month, l.currency, l.transaction_type;
