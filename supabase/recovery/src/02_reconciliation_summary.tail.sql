-- ── SUMMARY: counts and amounts, never mixing currencies ──
WITH base AS (SELECT * FROM recon_result)
SELECT 'א. שורות לפי קטגוריה' AS section, month::text AS month, coalesce(currency, '—') AS currency,
       category AS key, count(*) AS rows, NULL::numeric AS amount
FROM base GROUP BY month, currency, category
UNION ALL
SELECT 'ב. חיובים חסרים — A (לשחזור)', month::text, currency, 'monthly_charge', count(*), sum(expected_charge)
FROM base WHERE category = 'A' AND charge_missing GROUP BY month, currency
UNION ALL
SELECT 'ג. זיכויים חסרים — A (לשחזור)', month::text, currency, 'automatic_payment', count(*),
       sum(-coalesce(existing_auto_charge, expected_charge))
FROM base WHERE category = 'A' AND credit_missing GROUP BY month, currency
UNION ALL
SELECT 'ד. חיובים חסרים לכאורה — B (בדיקה, סכום אינדיקטיבי נוכחי)', month::text, coalesce(currency, '—'), 'monthly_charge', count(*), sum(indicative_charge)
FROM base WHERE category = 'B' AND charge_missing GROUP BY month, currency
UNION ALL
SELECT 'ה. זיכויים חסרים לכאורה — B (בדיקה, סכום אינדיקטיבי)', month::text, coalesce(currency, '—'), 'automatic_payment', count(*),
       sum(-coalesce(existing_auto_charge, indicative_charge))
FROM base WHERE category = 'B' AND credit_missing GROUP BY month, currency
UNION ALL
SELECT 'ו. סיבות B', month::text, coalesce(currency, '—'), split_part(reason, ':', 1), count(*), NULL
FROM base, unnest(b_reasons) AS reason GROUP BY month, currency, split_part(reason, ':', 1)
UNION ALL
SELECT 'ז. חשד לכפילות קיימת', month::text, coalesce(currency, '—'), 'suspected_duplicate', count(*), NULL
FROM base WHERE suspected_duplicate GROUP BY month, currency
UNION ALL
SELECT 'ח. תאריך התחלה חסר', NULL, coalesce(cur_currency, '—'), 'start_date_' || category, count(*), NULL
FROM recon_start_date GROUP BY cur_currency, category
UNION ALL
SELECT 'ט. סה"כ תנועות במערכת (פעילות)', billing_month::text, currency, transaction_type, count(*), sum(amount)
FROM recon_tx, recon_params p
WHERE is_active AND billing_month BETWEEN p.from_month AND p.to_month
GROUP BY billing_month, currency, transaction_type
ORDER BY 1, 2, 3, 4;
