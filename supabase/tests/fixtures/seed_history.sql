-- Synthetic history Aug–Oct 2026 reproducing every reconciliation scenario.
-- Fixed UUIDs: 00000000-0000-0000-0000-0000000000NN  (NN = scenario number)
-- Inserted as postgres (bypasses the app restrictions), like the real cron.

CREATE OR REPLACE FUNCTION pg_temp.u(n int) RETURNS uuid LANGUAGE sql AS
$$ SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid $$;

CREATE OR REPLACE FUNCTION pg_temp.tx(n int, m date, typ text, amt numeric, cur text,
                                      created timestamptz DEFAULT NULL, note text DEFAULT NULL,
                                      cancelled boolean DEFAULT false)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO tuition_transactions (student_id, billing_month, transaction_date, amount, currency,
                                    transaction_type, source, note, created_at, cancelled_at, cancellation_reason)
  VALUES (pg_temp.u(n), m,
          CASE typ WHEN 'monthly_charge' THEN m + 19 WHEN 'automatic_payment' THEN m + 20 ELSE coalesce(created::date, m + 25) END,
          amt, cur, typ,
          CASE WHEN typ IN ('monthly_charge','automatic_payment') THEN 'automatic' ELSE 'manual' END,
          note,
          coalesce(created, (m + 20)::timestamptz + interval '2 hours'),
          CASE WHEN cancelled THEN now() END,
          CASE WHEN cancelled THEN 'בוטל בבדיקה' END)
$$;

-- students: (n, name, tuition, rank, currency, start_date)
INSERT INTO students (id, first_name, last_name, class_name, passport_or_id, tuition, tuition_rank, tuition_currency, tuition_start_date) VALUES
 (pg_temp.u(1),  'א', 'אשראי-נמחק',            'כיתה ג', 'P01', '1400', 'אשראי',       'ILS', NULL),
 (pg_temp.u(2),  'ב', 'מזומן-נמחק',            'כיתה ג', 'P02', '1000', 'מזומן',       'ILS', NULL),
 (pg_temp.u(3),  'ג', 'ידני-מחליף-אותו-חודש',  'כיתה ג', 'P03', '1200', 'מזומן',       'ILS', NULL),
 (pg_temp.u(4),  'ד', 'ידני-מחליף-חודש-אחר',   'כיתה ג', 'P04', '1200', 'מזומן',       'ILS', NULL),
 (pg_temp.u(5),  'ה', 'ידני-נוסף-ספרים',       'כיתה ד', 'P05', '900',  'בנקאי',       'ILS', '2026-08-20'),
 (pg_temp.u(6),  'ו', 'אשראי-תשלום-ידני',      'כיתה ג', 'P06', '1400', 'אשראי',       'ILS', NULL),
 (pg_temp.u(7),  'ז', 'סכום-השתנה',            'כיתה ג', 'P07', '1200', 'מזומן',       'ILS', NULL),
 (pg_temp.u(8),  'ח', 'מרכז-הצדקה',            'כיתה ה', 'P08', '800',  'מרכז הצדקה',  'ILS', '2026-08-20'),
 (pg_temp.u(9),  'ט', 'אא-זוכה-בעבר',          'כיתה ה', 'P09', '700',  'א"א',         'ILS', '2026-08-20'),
 (pg_temp.u(10), 'י', 'דולר-אשראי-נמחק',       'כיתה ג', 'P10', '400',  'אשראי',       'USD', NULL),
 (pg_temp.u(12), 'יב','חסר-ספטמבר',            'כיתה ו', 'P12', '1100', 'בנקאי',       'ILS', '2026-08-20'),
 (pg_temp.u(13), 'יג','מתחיל-בנובמבר',          'כיתה ו', 'P13', '1300', 'אשראי',       'ILS', '2026-11-20'),
 (pg_temp.u(14), 'יד','התאמה-חיובית-תקין',     'כיתה ו', 'P14', '1000', 'אשראי',       'ILS', '2026-08-20'),
 (pg_temp.u(15), 'טו','חיוב-בוטל',             'כיתה ו', 'P15', '1000', 'מזומן',       'ILS', '2026-08-20'),
 (pg_temp.u(17), 'יז','ללא-תאריך-ללא-היסטוריה','כיתה א', 'P17', '1500', 'מזומן',       'ILS', NULL),
 (pg_temp.u(18), 'יח','תקין-מלא',              'כיתה ו', 'P18', '1250', 'קירוב לבבות', 'ILS', '2026-08-20'),
 (pg_temp.u(19), 'יט','ספטמבר-ראשון-נמחק',     'כיתה ב', 'P19', '1000', 'מזומן',       'ILS', NULL),
 (pg_temp.u(20), 'כ', 'שכל-לא-מספרי',          'כיתה ב', 'P20', '1,400','מזומן',       'ILS', '2026-08-20'),
 (pg_temp.u(21), 'כא','שכל-אפס-הפסיק',          'כיתה ב', 'P21', '0',    'מזומן',       'ILS', '2026-08-20');

-- alumni (graduated in October)
INSERT INTO alumni (id, first_name, last_name, passport_or_id, tuition, tuition_rank, tuition_currency, tuition_start_date, graduated_at)
VALUES (pg_temp.u(16), 'טז', 'בוגר', 'P16', '1000', 'מזומן', 'ILS', '2026-08-20', '2026-10-05');

-- 1: credit, wiped → Oct charge+credit missing (A)
SELECT pg_temp.tx(1, '2026-08-01', 'monthly_charge', -1400, 'ILS'), pg_temp.tx(1, '2026-08-01', 'automatic_payment', 1400, 'ILS'),
       pg_temp.tx(1, '2026-09-01', 'monthly_charge', -1400, 'ILS'), pg_temp.tx(1, '2026-09-01', 'automatic_payment', 1400, 'ILS');
-- 2: cash, wiped → Oct charge missing (A), no credit
SELECT pg_temp.tx(2, '2026-08-01', 'monthly_charge', -1000, 'ILS'), pg_temp.tx(2, '2026-09-01', 'monthly_charge', -1000, 'ILS'),
       pg_temp.tx(2, '2026-09-01', 'manual_payment', 1000, 'ILS', '2026-09-28', 'מזומן ספטמבר');
-- 3: wiped, secretary entered manual charge for OCTOBER instead (B)
SELECT pg_temp.tx(3, '2026-08-01', 'monthly_charge', -1200, 'ILS'), pg_temp.tx(3, '2026-09-01', 'monthly_charge', -1200, 'ILS'),
       pg_temp.tx(3, '2026-10-01', 'manual_charge', -1200, 'ILS', '2026-10-27', 'חיוב אוקטובר — לא נוצר אוטומטית');
-- 4: wiped, manual charge recorded under NOVEMBER, created Oct 30 (B)
SELECT pg_temp.tx(4, '2026-08-01', 'monthly_charge', -1200, 'ILS'), pg_temp.tx(4, '2026-09-01', 'monthly_charge', -1200, 'ILS'),
       pg_temp.tx(4, '2026-11-01', 'manual_charge', -1200, 'ILS', '2026-10-30', 'חיוב');
-- 5: start date intact, auto charges every month + extra manual charge in Oct (books) → existing duplicate suspicion (B, no action)
SELECT pg_temp.tx(5, m, 'monthly_charge', -900, 'ILS'), pg_temp.tx(5, m, 'automatic_payment', 900, 'ILS')
FROM unnest(ARRAY['2026-08-01','2026-09-01','2026-10-01']::date[]) m;
SELECT pg_temp.tx(5, '2026-10-01', 'manual_charge', -150, 'ILS', '2026-10-10', 'ספרים');
-- 6: credit, wiped, secretary recorded a manual payment for Oct (B — payment may already cover)
SELECT pg_temp.tx(6, '2026-08-01', 'monthly_charge', -1400, 'ILS'), pg_temp.tx(6, '2026-08-01', 'automatic_payment', 1400, 'ILS'),
       pg_temp.tx(6, '2026-09-01', 'monthly_charge', -1400, 'ILS'), pg_temp.tx(6, '2026-09-01', 'automatic_payment', 1400, 'ILS'),
       pg_temp.tx(6, '2026-10-01', 'manual_payment', 1400, 'ILS', '2026-10-22', 'אשראי ידני');
-- 7: amount changed (Sep 1000, now 1200), Oct missing (B)
SELECT pg_temp.tx(7, '2026-08-01', 'monthly_charge', -1000, 'ILS'), pg_temp.tx(7, '2026-09-01', 'monthly_charge', -1000, 'ILS');
-- 8: 'מרכז הצדקה' — charged, never credited (old function list) (B)
SELECT pg_temp.tx(8, m, 'monthly_charge', -800, 'ILS') FROM unnest(ARRAY['2026-08-01','2026-09-01','2026-10-01']::date[]) m;
-- 9: 'א"א' credited by the legacy function (B — unauthorized credit)
SELECT pg_temp.tx(9, m, 'monthly_charge', -700, 'ILS'), pg_temp.tx(9, m, 'automatic_payment', 700, 'ILS')
FROM unnest(ARRAY['2026-08-01','2026-09-01','2026-10-01']::date[]) m;
-- 10: USD credit, wiped → Oct charge+credit missing in USD (A)
SELECT pg_temp.tx(10, '2026-08-01', 'monthly_charge', -400, 'USD'), pg_temp.tx(10, '2026-08-01', 'automatic_payment', 400, 'USD'),
       pg_temp.tx(10, '2026-09-01', 'monthly_charge', -400, 'USD'), pg_temp.tx(10, '2026-09-01', 'automatic_payment', 400, 'USD');
-- 11: orphan charges (no student/alumni) (B)
SELECT pg_temp.tx(11, '2026-08-01', 'monthly_charge', -500, 'ILS');
-- 12: Sep missing, Aug & Oct present → A (charge + credit)
SELECT pg_temp.tx(12, m, 'monthly_charge', -1100, 'ILS'), pg_temp.tx(12, m, 'automatic_payment', 1100, 'ILS')
FROM unnest(ARRAY['2026-08-01','2026-10-01']::date[]) m;
-- 13: starts in November, nothing yet → C
-- 14: fully OK + positive adjustment in Sep → C
SELECT pg_temp.tx(14, m, 'monthly_charge', -1000, 'ILS'), pg_temp.tx(14, m, 'automatic_payment', 1000, 'ILS')
FROM unnest(ARRAY['2026-08-01','2026-09-01','2026-10-01']::date[]) m;
SELECT pg_temp.tx(14, '2026-09-01', 'adjustment', 50, 'ILS', '2026-09-25', 'החזר עודף');
-- 15: Oct automatic charge cancelled by a human → C (respected, not recreated)
SELECT pg_temp.tx(15, '2026-08-01', 'monthly_charge', -1000, 'ILS'), pg_temp.tx(15, '2026-09-01', 'monthly_charge', -1000, 'ILS'),
       pg_temp.tx(15, '2026-10-01', 'monthly_charge', -1000, 'ILS', NULL, NULL, true);
-- 16: graduated (alumni) — Aug, Sep charged, Oct missing → B
SELECT pg_temp.tx(16, '2026-08-01', 'monthly_charge', -1000, 'ILS'), pg_temp.tx(16, '2026-09-01', 'monthly_charge', -1000, 'ILS');
-- 17: no start date and no history → B
-- 18: fully OK 'קירוב לבבות' (credited under a fixed function) → C
SELECT pg_temp.tx(18, m, 'monthly_charge', -1250, 'ILS'), pg_temp.tx(18, m, 'automatic_payment', 1250, 'ILS')
FROM unnest(ARRAY['2026-08-01','2026-09-01','2026-10-01']::date[]) m;
-- 19: first charged in September, wiped → Oct A; start-date restore B (first month ≠ Aug)
SELECT pg_temp.tx(19, '2026-09-01', 'monthly_charge', -1000, 'ILS');
