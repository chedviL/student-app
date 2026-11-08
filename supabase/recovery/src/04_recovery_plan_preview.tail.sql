-- ── RECOVERY PLAN PREVIEW: exactly the rows 05_recovery_execute.sql would insert ──
-- Copy plan_hash and plan_rows into the approval block of 05_recovery_execute.sql.
WITH plan AS (SELECT * FROM recon_plan),
h AS (
  SELECT
    md5(coalesce(string_agg(format('%s|%s|%s|%s|%s|%s', student_id, billing_month, transaction_type,
                                   amount, currency, transaction_date), ','
                            ORDER BY student_id, billing_month, transaction_type), '')) AS plan_hash,
    count(*) AS plan_rows
  FROM plan
)
SELECT
  p.billing_month, p.currency, p.transaction_type, p.name, p.student_id,
  p.transaction_date, p.amount, p.evidence,
  sum(p.amount) OVER (PARTITION BY p.billing_month, p.currency, p.transaction_type) AS subtotal_month_currency_type,
  count(*)      OVER (PARTITION BY p.billing_month, p.currency, p.transaction_type) AS count_month_currency_type,
  h.plan_hash, h.plan_rows
FROM plan p CROSS JOIN h
UNION ALL
-- always return at least one row so the hash is visible even when the plan is empty
SELECT NULL, NULL, NULL, '(empty plan)', NULL, NULL, NULL, NULL, NULL, NULL, h.plan_hash, h.plan_rows
FROM h WHERE h.plan_rows = 0
ORDER BY 1, 2, 3, 4;
