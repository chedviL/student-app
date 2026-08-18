-- ============================================================
-- TUITION HISTORY BACKFILL / INITIALIZATION
-- ============================================================
--
-- מטרה:
--   אתחול היסטוריית שכ"ל עבור כל תלמיד שיש לו tuition_start_date,
--   החל מהחודש הראשון לגבייה ועד החודש האחרון שהושלם.
--
-- עקרונות:
--   1. משתמש ב-process_monthly_tuition הקיים — לא משכפל לוגיקה.
--   2. Idempotent — ON CONFLICT DO NOTHING מונע כפילויות.
--      ניתן להריץ שוב בבטחה.
--   3. לא יוצר חיובים עתידיים.
--   4. ה-Cron הקיים ממשיך לטפל בחודשים הבאים.
--
-- ⚠️  מגבלה חשובה — קרא לפני הרצה על production:
--   הפונקציה process_monthly_tuition משתמשת בערכי tuition,
--   tuition_rank ו-tuition_currency הנוכחיים של כל תלמיד.
--   אין במערכת היסטוריה של שינויים בסכום/דרוג/מטבע.
--   לכן: חיובים היסטוריים יחושבו לפי הסכום הנוכחי,
--   גם אם הסכום השתנה בעבר.
--   לנתוני בדיקה — זה מקובל.
--   לנתוני production — ודאי שהסכומים הנוכחיים משקפים את כל התקופה.
--
-- ============================================================
-- שלב 0 — DIAGNOSTIC: בדוק מה יכלל ב-backfill
-- ============================================================
-- הרץ קודם כדי לראות אילו תלמידים יקבלו היסטוריה ומאיזה חודש:

/*
SELECT
  passport_or_id,
  last_name,
  first_name,
  tuition,
  tuition_currency,
  tuition_start_date,
  date_trunc('month', tuition_start_date)::date AS first_billing_month,
  -- החודש האחרון שאמור להיות מחויב:
  -- אם היום לפני ה-21: החודש הקודם. אם 21+: החודש הנוכחי.
  CASE
    WHEN extract(day FROM current_date) < 21
    THEN (date_trunc('month', current_date) - interval '1 month')::date
    ELSE date_trunc('month', current_date)::date
  END AS last_billing_month
FROM students
WHERE
  tuition IS NOT NULL
  AND tuition ~ '^[0-9]+(\.[0-9]+)?$'
  AND tuition::numeric > 0
  AND tuition_currency IN ('ILS', 'USD')
  AND tuition_start_date IS NOT NULL
ORDER BY tuition_start_date;
*/

-- ============================================================
-- שלב 1 — BACKFILL FUNCTION
-- ============================================================
-- יוצר פונקציה שמריצה process_monthly_tuition לכל חודש
-- מהחודש הראשון ועד החודש האחרון שהושלם.

CREATE OR REPLACE FUNCTION run_tuition_backfill()
RETURNS TABLE(
  billing_month   date,
  students_processed integer,
  message         text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_month   date;
  v_last_month      date;
  v_earliest_start  date;
  v_count           integer;
BEGIN
  -- החודש האחרון לעיבוד:
  -- לפני ה-21 בחודש → החודש הקודם
  -- ה-21 ואילך → החודש הנוכחי
  IF extract(day FROM current_date) < 21 THEN
    v_last_month := (date_trunc('month', current_date) - interval '1 month')::date;
  ELSE
    v_last_month := date_trunc('month', current_date)::date;
  END IF;

  -- החודש הראשון לעיבוד: המוקדם ביותר מבין כל tuition_start_date
  SELECT date_trunc('month', MIN(tuition_start_date))::date
  INTO v_earliest_start
  FROM students
  WHERE
    tuition IS NOT NULL
    AND tuition ~ '^[0-9]+(\.[0-9]+)?$'
    AND tuition::numeric > 0
    AND tuition_currency IN ('ILS', 'USD')
    AND tuition_start_date IS NOT NULL;

  -- אם אין תלמידים כשירים — סיים
  IF v_earliest_start IS NULL THEN
    billing_month      := NULL;
    students_processed := 0;
    message            := 'אין תלמידים כשירים לעיבוד';
    RETURN NEXT;
    RETURN;
  END IF;

  -- אם תאריך ההתחלה המוקדם ביותר הוא בעתיד — סיים
  IF v_earliest_start > v_last_month THEN
    billing_month      := v_earliest_start;
    students_processed := 0;
    message            := 'תאריך ההתחלה המוקדם ביותר הוא בעתיד — אין מה לעבד';
    RETURN NEXT;
    RETURN;
  END IF;

  -- לולאה על כל חודש מהמוקדם ביותר ועד החודש האחרון
  v_current_month := v_earliest_start;

  WHILE v_current_month <= v_last_month LOOP

    -- הרץ את process_monthly_tuition הקיים לחודש זה
    -- ON CONFLICT DO NOTHING בתוך הפונקציה מונע כפילויות
    SELECT COUNT(*) INTO v_count
    FROM process_monthly_tuition(v_current_month);

    billing_month      := v_current_month;
    students_processed := v_count;
    message            := 'עובד בהצלחה (כפילויות נדחו אוטומטית)';
    RETURN NEXT;

    -- עבור לחודש הבא
    v_current_month := (v_current_month + interval '1 month')::date;

  END LOOP;

END;
$$;

-- ============================================================
-- שלב 2 — הרצת ה-BACKFILL
-- ============================================================
-- הרץ את השאילתה הבאה כדי לבצע את האתחול:
-- (ניתן להריץ שוב — בטוח לחלוטין)

/*
SELECT * FROM run_tuition_backfill()
ORDER BY billing_month;
*/

-- ============================================================
-- שלב 3 — אימות תוצאות
-- ============================================================
-- לאחר הרצת ה-backfill, בדוק שהנתונים נראים נכון:

/*
-- כמה חודשים נוצרו לכל תלמיד:
SELECT
  s.last_name,
  s.first_name,
  s.tuition_start_date,
  COUNT(DISTINCT t.billing_month) AS months_count,
  MIN(t.billing_month)            AS first_month,
  MAX(t.billing_month)            AS last_month
FROM students s
JOIN tuition_transactions t ON t.student_id = s.id
WHERE t.transaction_type = 'monthly_charge'
  AND t.source = 'automatic'
GROUP BY s.id, s.last_name, s.first_name, s.tuition_start_date
ORDER BY s.last_name;
*/

/*
-- יתרות נוכחיות לאחר ה-backfill:
SELECT
  s.last_name,
  s.first_name,
  b.currency,
  b.current_balance,
  b.status
FROM tuition_balances b
JOIN students s ON s.id = b.student_id
ORDER BY b.current_balance;
*/

-- ============================================================
-- שלב 4 — ניקוי (אופציונלי, לאחר שה-backfill הצליח)
-- ============================================================
-- ניתן להשאיר את הפונקציה — היא idempotent ובטוחה.
-- אם רוצים להסיר אותה לאחר השימוש:

/*
DROP FUNCTION IF EXISTS run_tuition_backfill();
*/
