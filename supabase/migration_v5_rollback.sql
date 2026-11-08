-- ============================================================
-- ROLLBACK for migration_v5_tuition_integrity.sql
-- ⛔ Run only if v5 must be undone, and only with explicit approval.
-- Restores the two functions EXACTLY as deployed in production before v5
-- (captured from production on 2026-11-08 by a read-only backup) and removes the
-- v5 triggers/functions. Audit tables are KEPT (they hold history) unless the
-- commented block at the end is run deliberately. Changes no financial data.
-- ============================================================
BEGIN;
DROP TRIGGER  IF EXISTS trg_students_protect_start_date ON public.students;
DROP TRIGGER  IF EXISTS trg_students_tuition_audit      ON public.students;
DROP FUNCTION IF EXISTS public.protect_tuition_start_date();
DROP FUNCTION IF EXISTS public.log_student_tuition_changes();
DROP FUNCTION IF EXISTS public.tuition_health_check(date);

-- process_monthly_tuition(date): production definition before v5
CREATE OR REPLACE FUNCTION public.process_monthly_tuition(p_billing_month date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date)
 RETURNS TABLE(processed_student_id uuid, student_name text, action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  rec record;
  v_amount numeric(12,2);
  v_charge_date date;
  v_payment_date date;
begin

  -- billing_month תמיד מייצג את החודש באמצעות היום הראשון
  p_billing_month := date_trunc('month', p_billing_month)::date;

  -- תאריכי הפעולות בפועל
  v_charge_date :=
    (p_billing_month + interval '19 days')::date; -- יום 20

  v_payment_date :=
    (p_billing_month + interval '20 days')::date; -- יום 21

  for rec in
    select
      id,
      coalesce(last_name, '') || ' ' || coalesce(first_name, '') as full_name,
      tuition,
      trim(tuition_rank) as tuition_rank,
      tuition_currency,
      tuition_start_date
    from students
    where
      tuition is not null
      and tuition ~ '^[0-9]+(\.[0-9]+)?$'
      and tuition::numeric > 0
      and tuition_currency in ('ILS', 'USD')
      and tuition_start_date is not null
      and date_trunc('month', tuition_start_date)::date <= p_billing_month
  loop

    v_amount := rec.tuition::numeric;

    -- חיוב חודשי — 20 בחודש
    insert into tuition_transactions
      (
        student_id,
        billing_month,
        transaction_date,
        amount,
        currency,
        transaction_type,
        source,
        note
      )
    values
      (
        rec.id,
        p_billing_month,
        v_charge_date,
        -v_amount,
        rec.tuition_currency,
        'monthly_charge',
        'automatic',
        'חיוב שכ"ל חודשי אוטומטי'
      )
    on conflict do nothing;

    processed_student_id := rec.id;
    student_name := rec.full_name;
    action := 'charged';
    return next;

    -- זיכוי אוטומטי — 21 בחודש
    -- רק אשראי / בנקאי / מרכז הצדקה
    if rec.tuition_rank in ('אשראי', 'בנקאי', 'מרכז הצדקה') then

      insert into tuition_transactions
        (
          student_id,
          billing_month,
          transaction_date,
          amount,
          currency,
          transaction_type,
          source,
          note
        )
      values
        (
          rec.id,
          p_billing_month,
          v_payment_date,
          v_amount,
          rec.tuition_currency,
          'automatic_payment',
          'automatic',
          'תשלום אוטומטי — ' || rec.tuition_rank
        )
      on conflict do nothing;

      processed_student_id := rec.id;
      student_name := rec.full_name;
      action := 'charged_and_paid';
      return next;

    end if;

  end loop;

end;
$function$;

REVOKE ALL ON FUNCTION public.process_monthly_tuition(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_monthly_tuition(date) TO service_role;

-- run_tuition_backfill(): production definition before v5
CREATE OR REPLACE FUNCTION public.run_tuition_backfill()
 RETURNS TABLE(billing_month date, students_processed integer, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$;

REVOKE ALL ON FUNCTION public.run_tuition_backfill() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_tuition_backfill() TO service_role;

-- helper functions used only by v5 code (safe to drop once the functions above are restored)
DROP FUNCTION IF EXISTS public.tuition_amount(text);
DROP FUNCTION IF EXISTS public.tuition_auto_credit_ranks();
COMMIT;

-- Optional, separately approved: remove v5 tables (DELETES their history)
-- DROP TABLE IF EXISTS public.student_tuition_audit, public.tuition_processing_runs, public.tuition_recovery_log;
