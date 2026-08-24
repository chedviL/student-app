-- Step 1: run this alone first
ALTER TABLE public.alumni ADD COLUMN IF NOT EXISTS tuition_currency text;

-- Step 2: run this after step 1 succeeds
CREATE OR REPLACE VIEW public.tuition_balances
WITH (security_invoker = true)
AS
SELECT
  s.id                AS student_id,
  s.tuition_currency  AS currency,
  COALESCE(SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL), 0) AS current_balance,
  CASE
    WHEN s.tuition_currency IS NULL THEN 'no_currency'
    WHEN COALESCE(SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL), 0) < 0 THEN 'debt'
    ELSE 'ok'
  END AS status
FROM public.students s
LEFT JOIN public.tuition_transactions t
  ON t.student_id = s.id AND t.currency = s.tuition_currency
GROUP BY s.id, s.tuition_currency

UNION ALL

SELECT
  a.id                AS student_id,
  a.tuition_currency  AS currency,
  COALESCE(SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL), 0) AS current_balance,
  CASE
    WHEN a.tuition_currency IS NULL THEN 'no_currency'
    WHEN COALESCE(SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL), 0) < 0 THEN 'debt'
    ELSE 'ok'
  END AS status
FROM public.alumni a
LEFT JOIN public.tuition_transactions t
  ON t.student_id = a.id AND t.currency = a.tuition_currency
GROUP BY a.id, a.tuition_currency;
