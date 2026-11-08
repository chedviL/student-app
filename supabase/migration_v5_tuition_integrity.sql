-- ============================================================
-- MIGRATION v5: TUITION INTEGRITY
-- ============================================================
-- ⚠️  טרם אושר להרצה בפרודקשן. אין להריץ ללא אישור מפורש.
--
-- מה המיגרציה עושה (ורק זה):
--   1. tuition_auto_credit_ranks() — מקור אמת יחיד לארבעת דירוגי הזיכוי.
--   2. student_tuition_audit — היסטוריית שינויים לשדות שכ"ל
--      (tuition, tuition_rank, tuition_currency, tuition_start_date).
--      מעכשיו יהיו "ערכים היסטוריים מאומתים" — היום אין כאלה.
--   3. טריגר שחוסם מחיקה (→ NULL) של tuition_start_date ממשתמשי האפליקציה
--      (anon / authenticated). postgres / service_role (SQL Editor, סקריפטים) מורשים.
--   4. tuition_processing_runs — רישום כל הרצה של החיוב החודשי (ניטור Cron).
--   5. tuition_recovery_log — Audit לכל תנועה שתיווצר בשחזור.
--   6. process_monthly_tuition — גרסה מתוקנת:
--        • זיכוי רק לארבעת הדירוגים המאושרים (לא 'א"א').
--        • transaction_date: חיוב = 20 לחודש, זיכוי = 21 לחודש.
--        • הזיכוי נגזר מהחיוב הפעיל של אותו חודש (אותו סכום ומטבע) —
--          אין זיכוי בלי חיוב, ואין זיכוי בסכום שונה מהחיוב.
--        • מסרבת לעבד חודש עבר/עתיד (מונע Backfill עיוור שמתעלם מחיובים ידניים).
--        • advisory lock — שתי הרצות במקביל לא יתנגשו.
--        • רושמת כל הרצה ב-tuition_processing_runs.
--   7. run_tuition_backfill — מנוטרלת (זורקת שגיאה). השחזור נעשה רק דרך
--      supabase/recovery/tuition_recovery_execute.sql עם אישור.
--   8. tuition_health_check(month) — בדיקות ניטור לקריאה בלבד.
--
-- מה המיגרציה *לא* עושה:
--   • לא משנה, מוחקת או יוצרת שום תנועה כספית.
--   • לא משנה את תזמון ה-Cron.
--   • לא משנה תאריכי התחלה של תלמידים.
--   • לא משנה מדיניות RLS קיימת של students / tuition_transactions.
--
-- טרנזקציה אחת: BEGIN ... COMMIT. כישלון בכל שלב = שום דבר לא משתנה.
-- תוכנית Rollback: בסוף הקובץ.
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- 1. AUTO-CREDIT RANKS — single source of truth (SQL side)
-- ════════════════════════════════════════════════════════════
-- ⚠️ חייב להיות זהה ל-src/constants/tuitionRanks.ts (נבדק אוטומטית בטסט).

CREATE OR REPLACE FUNCTION public.tuition_auto_credit_ranks()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
-- AUTO_CREDIT_RANKS:BEGIN
    'אשראי',
    'בנקאי',
    'קירוב לבבות',
    'מרכז הצדקה'
-- AUTO_CREDIT_RANKS:END
  ]::text[];
$$;

GRANT EXECUTE ON FUNCTION public.tuition_auto_credit_ranks() TO authenticated, service_role;

-- Safe parse of students.tuition (text). NULL when not a clean positive-or-zero number.
-- (Postgres does not guarantee short-circuit of `x ~ re AND x::numeric > 0`.)
CREATE OR REPLACE FUNCTION public.tuition_amount(p_tuition text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE WHEN trim(p_tuition) ~ '^[0-9]+(\.[0-9]+)?$' THEN trim(p_tuition)::numeric END;
$$;

GRANT EXECUTE ON FUNCTION public.tuition_amount(text) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════
-- 2. STUDENT TUITION AUDIT — history of tuition-related fields
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.student_tuition_audit (
  id          bigserial   PRIMARY KEY,
  student_id  uuid        NOT NULL,          -- no FK: survives graduation (DELETE)
  operation   text        NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  field       text        NOT NULL,
  old_value   text,
  new_value   text,
  changed_at  timestamptz NOT NULL DEFAULT now(),
  changed_by  uuid,                          -- auth.uid() — NULL for SQL Editor / cron
  db_role     text        NOT NULL DEFAULT current_user
);

CREATE INDEX IF NOT EXISTS idx_student_tuition_audit_student
  ON public.student_tuition_audit(student_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_student_tuition_audit_field_time
  ON public.student_tuition_audit(field, changed_at);

ALTER TABLE public.student_tuition_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student_tuition_audit_select" ON public.student_tuition_audit;
CREATE POLICY "student_tuition_audit_select"
  ON public.student_tuition_audit FOR SELECT
  USING (auth.role() = 'authenticated');

-- Clients may read, never write. The trigger below is SECURITY DEFINER.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_tuition_audit FROM anon, authenticated;
REVOKE ALL ON public.student_tuition_audit FROM anon;
GRANT SELECT ON public.student_tuition_audit TO authenticated;

CREATE OR REPLACE FUNCTION public.log_student_tuition_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid  uuid;
  v_role text := session_user;   -- placeholder, replaced below
BEGIN
  -- auth.uid() reads the JWT of the PostgREST request; NULL in SQL Editor / cron.
  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;
  -- Inside SECURITY DEFINER current_user is the owner; the caller's role is
  -- exposed by PostgREST in request.jwt.claim(s). Fall back to session_user.
  v_role := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF((NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    session_user::text
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.student_tuition_audit (student_id, operation, field, old_value, new_value, changed_by, db_role)
    SELECT NEW.id, 'INSERT', f.field, NULL, f.new_value, v_uid, v_role
    FROM (VALUES
      ('tuition',            NEW.tuition),
      ('tuition_rank',       NEW.tuition_rank),
      ('tuition_currency',   NEW.tuition_currency),
      ('tuition_start_date', NEW.tuition_start_date::text)
    ) AS f(field, new_value)
    WHERE f.new_value IS NOT NULL;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.student_tuition_audit (student_id, operation, field, old_value, new_value, changed_by, db_role)
    SELECT NEW.id, 'UPDATE', f.field, f.old_value, f.new_value, v_uid, v_role
    FROM (VALUES
      ('tuition',            OLD.tuition,                  NEW.tuition),
      ('tuition_rank',       OLD.tuition_rank,             NEW.tuition_rank),
      ('tuition_currency',   OLD.tuition_currency,         NEW.tuition_currency),
      ('tuition_start_date', OLD.tuition_start_date::text, NEW.tuition_start_date::text)
    ) AS f(field, old_value, new_value)
    WHERE f.old_value IS DISTINCT FROM f.new_value;
    RETURN NEW;

  ELSE -- DELETE (e.g. graduation)
    INSERT INTO public.student_tuition_audit (student_id, operation, field, old_value, new_value, changed_by, db_role)
    SELECT OLD.id, 'DELETE', f.field, f.old_value, NULL, v_uid, v_role
    FROM (VALUES
      ('tuition',            OLD.tuition),
      ('tuition_rank',       OLD.tuition_rank),
      ('tuition_currency',   OLD.tuition_currency),
      ('tuition_start_date', OLD.tuition_start_date::text)
    ) AS f(field, old_value)
    WHERE f.old_value IS NOT NULL;
    RETURN OLD;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_student_tuition_changes() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_students_tuition_audit ON public.students;
CREATE TRIGGER trg_students_tuition_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_student_tuition_changes();

-- ════════════════════════════════════════════════════════════
-- 3. PROTECT tuition_start_date FROM BEING NULLED BY THE APP
-- ════════════════════════════════════════════════════════════
-- SECURITY INVOKER on purpose: current_user is the PostgREST role
-- ('authenticated' / 'anon') for app requests, and 'postgres' /
-- 'service_role' for SQL Editor, cron and admin scripts.
-- Changing the date to ANOTHER date is allowed (and audited above).

CREATE OR REPLACE FUNCTION public.protect_tuition_start_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.tuition_start_date IS NOT NULL
     AND NEW.tuition_start_date IS NULL
     AND current_user IN ('authenticated', 'anon')
  THEN
    RAISE EXCEPTION 'אסור למחוק תאריך תחילת גבייה (tuition_start_date) של תלמיד קיים. לשינוי — הזינו תאריך חדש; למחיקה — פנו למנהל המערכת.'
      USING ERRCODE = 'check_violation',
            HINT    = 'student_id=' || OLD.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_protect_start_date ON public.students;
CREATE TRIGGER trg_students_protect_start_date
  BEFORE UPDATE OF tuition_start_date ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.protect_tuition_start_date();

-- ════════════════════════════════════════════════════════════
-- 4. PROCESSING RUN LOG (cron monitoring)
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tuition_processing_runs (
  id                     bigserial   PRIMARY KEY,
  billing_month          date        NOT NULL,
  started_at             timestamptz NOT NULL DEFAULT clock_timestamp(),
  finished_at            timestamptz,
  invoked_by             text        NOT NULL DEFAULT session_user,
  eligible_students      integer,
  charges_created        integer,
  charges_existing       integer,
  credits_created        integer,
  credits_existing       integer,
  skipped_no_start_date  integer,   -- valid tuition+currency but NULL start date
  skipped_future_start   integer,
  status                 text        NOT NULL DEFAULT 'running'
                                     CHECK (status IN ('running', 'success'))
);

CREATE INDEX IF NOT EXISTS idx_tuition_processing_runs_month
  ON public.tuition_processing_runs(billing_month, started_at);

ALTER TABLE public.tuition_processing_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tuition_processing_runs_select" ON public.tuition_processing_runs;
CREATE POLICY "tuition_processing_runs_select"
  ON public.tuition_processing_runs FOR SELECT
  USING (auth.role() = 'authenticated');
REVOKE ALL ON public.tuition_processing_runs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tuition_processing_runs FROM authenticated;
GRANT SELECT ON public.tuition_processing_runs TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 5. RECOVERY AUDIT LOG
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.tuition_recovery_log (
  id               bigserial   PRIMARY KEY,
  batch_id         text        NOT NULL,
  transaction_id   uuid        NOT NULL UNIQUE,  -- the tuition_transactions row created
  student_id       uuid        NOT NULL,
  billing_month    date        NOT NULL,
  transaction_type text        NOT NULL,
  amount           numeric(12,2) NOT NULL,
  currency         text        NOT NULL CHECK (currency IN ('ILS', 'USD')),
  category         text        NOT NULL,          -- always 'A' (verified)
  evidence         text        NOT NULL,          -- why this amount / why this is missing
  approved_by      text        NOT NULL,          -- name of the approver (free text)
  executed_at      timestamptz NOT NULL DEFAULT now(),
  executed_by      text        NOT NULL DEFAULT session_user
);

CREATE INDEX IF NOT EXISTS idx_tuition_recovery_log_batch
  ON public.tuition_recovery_log(batch_id);

ALTER TABLE public.tuition_recovery_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tuition_recovery_log_select" ON public.tuition_recovery_log;
CREATE POLICY "tuition_recovery_log_select"
  ON public.tuition_recovery_log FOR SELECT
  USING (auth.role() = 'authenticated');
REVOKE ALL ON public.tuition_recovery_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tuition_recovery_log FROM authenticated;
GRANT SELECT ON public.tuition_recovery_log TO authenticated;

-- ════════════════════════════════════════════════════════════
-- 6. process_monthly_tuition — FIXED
-- ════════════════════════════════════════════════════════════
-- Same name, argument and result columns as the deployed function,
-- so the existing cron command `select process_monthly_tuition()` keeps working.
--
-- Charge (all eligible students, every rank):
--   amount = -tuition, transaction_date = 20th of billing month.
-- Credit (only tuition_auto_credit_ranks()):
--   amount = -(active automatic charge of the same month), same currency,
--   transaction_date = 21st. No active charge → no credit.
--
-- Idempotent: partial unique indexes uq_auto_monthly_charge / uq_auto_payment
-- + ON CONFLICT DO NOTHING. A cancelled automatic charge is NOT recreated
-- (the unique index still holds it) — cancellation is respected.

CREATE OR REPLACE FUNCTION public.process_monthly_tuition(
  p_billing_month date DEFAULT date_trunc('month', current_date)::date
)
RETURNS TABLE(
  processed_student_id uuid,
  student_name         text,
  action               text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_month          date := date_trunc('month', p_billing_month)::date;
  v_current_month  date := date_trunc('month', current_date)::date;
  v_charge_date    date;
  v_credit_date    date;
  v_ranks          text[] := public.tuition_auto_credit_ranks();
  v_run_id         bigint;
  rec              record;
  v_rows           integer;
  v_charge_amount  numeric(12,2);
  v_charge_curr    text;
  c_eligible       integer := 0;
  c_ch_new         integer := 0;
  c_ch_old         integer := 0;
  c_cr_new         integer := 0;
  c_cr_old         integer := 0;
BEGIN
  IF p_billing_month IS NULL THEN
    RAISE EXCEPTION 'billing month is required';
  END IF;

  -- Only the current month may be processed automatically.
  -- Past months must go through the reviewed recovery script (manual charges
  -- may already cover them); future months must never be charged in advance.
  IF v_month <> v_current_month
     AND COALESCE(current_setting('app.allow_non_current_month_processing', true), '') <> 'on'
  THEN
    RAISE EXCEPTION 'process_monthly_tuition: refusing to process % (current month is %). Past months require the reviewed recovery script.',
      v_month, v_current_month;
  END IF;

  v_charge_date := v_month + 19;   -- 20th
  v_credit_date := v_month + 20;   -- 21st

  -- Serialize concurrent runs for the same month (cron retry + manual run).
  PERFORM pg_advisory_xact_lock(hashtext('process_monthly_tuition'), (v_month - date '2000-01-01'));

  INSERT INTO public.tuition_processing_runs (billing_month, invoked_by)
  VALUES (v_month, session_user)
  RETURNING id INTO v_run_id;

  FOR rec IN
    SELECT
      s.id,
      COALESCE(s.last_name, '') || ' ' || COALESCE(s.first_name, '') AS full_name,
      public.tuition_amount(s.tuition)::numeric(12,2) AS amount,
      trim(s.tuition_rank)           AS tuition_rank,
      s.tuition_currency             AS currency
    FROM public.students s
    WHERE public.tuition_amount(s.tuition) > 0
      AND s.tuition_currency IN ('ILS', 'USD')
      AND s.tuition_start_date IS NOT NULL
      AND date_trunc('month', s.tuition_start_date)::date <= v_month
    ORDER BY s.id
  LOOP
    c_eligible := c_eligible + 1;

    -- ── charge (every rank) ──
    INSERT INTO public.tuition_transactions
      (student_id, billing_month, transaction_date, amount, currency,
       transaction_type, source, note)
    VALUES
      (rec.id, v_month, v_charge_date, -rec.amount, rec.currency,
       'monthly_charge', 'automatic', 'חיוב שכ"ל חודשי אוטומטי')
    ON CONFLICT DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;

    processed_student_id := rec.id;
    student_name         := rec.full_name;
    IF v_rows = 1 THEN
      c_ch_new := c_ch_new + 1;
      action   := 'charged';
    ELSE
      c_ch_old := c_ch_old + 1;
      action   := 'charge_exists';
    END IF;
    RETURN NEXT;

    -- ── credit (approved ranks only), mirrored from the ACTIVE charge ──
    IF rec.tuition_rank = ANY (v_ranks) THEN
      SELECT t.amount, t.currency
        INTO v_charge_amount, v_charge_curr
        FROM public.tuition_transactions t
       WHERE t.student_id       = rec.id
         AND t.billing_month    = v_month
         AND t.transaction_type = 'monthly_charge'
         AND t.source           = 'automatic'
         AND t.cancelled_at IS NULL;

      IF FOUND THEN
        INSERT INTO public.tuition_transactions
          (student_id, billing_month, transaction_date, amount, currency,
           transaction_type, source, note)
        VALUES
          (rec.id, v_month, v_credit_date, -v_charge_amount, v_charge_curr,
           'automatic_payment', 'automatic', 'תשלום אוטומטי — ' || rec.tuition_rank)
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS v_rows = ROW_COUNT;

        IF v_rows = 1 THEN
          c_cr_new := c_cr_new + 1;
          action   := 'credited';
        ELSE
          c_cr_old := c_cr_old + 1;
          action   := 'credit_exists';
        END IF;
        RETURN NEXT;
      END IF;
    END IF;
  END LOOP;

  UPDATE public.tuition_processing_runs r SET
    finished_at           = clock_timestamp(),
    eligible_students     = c_eligible,
    charges_created       = c_ch_new,
    charges_existing      = c_ch_old,
    credits_created       = c_cr_new,
    credits_existing      = c_cr_old,
    skipped_no_start_date = (
      SELECT count(*) FROM public.students s
      WHERE public.tuition_amount(s.tuition) > 0
        AND s.tuition_currency IN ('ILS', 'USD')
        AND s.tuition_start_date IS NULL),
    skipped_future_start  = (
      SELECT count(*) FROM public.students s
      WHERE public.tuition_amount(s.tuition) > 0
        AND s.tuition_currency IN ('ILS', 'USD')
        AND s.tuition_start_date IS NOT NULL
        AND date_trunc('month', s.tuition_start_date)::date > v_month),
    status                = 'success'
  WHERE r.id = v_run_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.process_monthly_tuition(date) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.process_monthly_tuition(date) FROM anon;
REVOKE ALL     ON FUNCTION public.process_monthly_tuition(date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.process_monthly_tuition(date) TO service_role;

-- ════════════════════════════════════════════════════════════
-- 7. DISABLE THE BLIND BACKFILL
-- ════════════════════════════════════════════════════════════
-- run_tuition_backfill() re-ran process_monthly_tuition for every past month
-- using CURRENT amounts/ranks and ignoring manual charges → double debt risk.

CREATE OR REPLACE FUNCTION public.run_tuition_backfill()
RETURNS TABLE(billing_month date, students_processed integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'run_tuition_backfill is disabled (v5). Use supabase/recovery/tuition_recovery_execute.sql after reconciliation and approval.';
END;
$$;

REVOKE ALL     ON FUNCTION public.run_tuition_backfill() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.run_tuition_backfill() TO service_role;

-- ════════════════════════════════════════════════════════════
-- 8. HEALTH CHECK (read-only, SECURITY INVOKER)
-- ════════════════════════════════════════════════════════════
-- select * from tuition_health_check();                -- current month
-- select * from tuition_health_check('2026-10-01');

CREATE OR REPLACE FUNCTION public.tuition_health_check(
  p_billing_month date DEFAULT date_trunc('month', current_date)::date
)
RETURNS TABLE(check_name text, severity text, student_id uuid, detail text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH m AS (
    SELECT date_trunc('month', p_billing_month)::date AS month,
           (date_trunc('month', p_billing_month) - interval '1 month')::date AS prev_month,
           (date_trunc('month', p_billing_month)::date + 20) AS run_day   -- 21st
  ),
  active AS (
    SELECT t.* FROM public.tuition_transactions t WHERE t.cancelled_at IS NULL
  ),
  eligible AS (
    SELECT s.*
    FROM public.students s, m
    WHERE public.tuition_amount(s.tuition) > 0
      AND s.tuition_currency IN ('ILS', 'USD')
      AND s.tuition_start_date IS NOT NULL
      AND date_trunc('month', s.tuition_start_date)::date <= m.month
  )
  -- 1. cron did not run (or did not finish) for the month, after the 21st
  SELECT 'cron_run_missing', 'critical', NULL::uuid,
         'אין הרצה מוצלחת של process_monthly_tuition לחודש ' || m.month::text
  FROM m
  WHERE current_date > m.run_day
    AND NOT EXISTS (SELECT 1 FROM public.tuition_processing_runs r
                    WHERE r.billing_month = m.month AND r.status = 'success')
    AND NOT EXISTS (SELECT 1 FROM active a
                    WHERE a.billing_month = m.month AND a.transaction_type = 'monthly_charge'
                      AND a.source = 'automatic')

  UNION ALL
  -- 2. eligible student without a charge for the month (after the 21st)
  SELECT 'eligible_not_charged', 'critical', e.id,
         'תלמיד כשיר ללא חיוב חודשי ל-' || m.month::text
  FROM eligible e, m
  WHERE current_date > m.run_day
    AND NOT EXISTS (SELECT 1 FROM public.tuition_transactions t
                    WHERE t.student_id = e.id AND t.billing_month = m.month
                      AND t.transaction_type = 'monthly_charge')

  UNION ALL
  -- 3. more than one active charge-like row in the month (automatic + manual overlap)
  SELECT 'possible_double_charge', 'warning', a.student_id,
         count(*)::text || ' חיובים פעילים (' ||
         string_agg(a.transaction_type || ' ' || a.amount::text || ' ' || a.currency, ', ' ORDER BY a.created_at) ||
         ') בחודש ' || m.month::text
  FROM active a, m
  WHERE a.billing_month = m.month
    AND (a.transaction_type IN ('monthly_charge', 'manual_charge')
         OR (a.transaction_type = 'adjustment' AND a.amount < 0))
  GROUP BY a.student_id, m.month
  HAVING count(*) > 1 AND count(*) FILTER (WHERE a.transaction_type = 'monthly_charge') >= 1

  UNION ALL
  -- 4. approved rank, charged, but no automatic credit (after the 21st)
  SELECT 'missing_auto_credit', 'critical', a.student_id,
         'חיוב ' || a.amount::text || ' ' || a.currency || ' ללא זיכוי אוטומטי (דירוג ' || coalesce(s.tuition_rank, '—') || ')'
  FROM active a
  JOIN public.students s ON s.id = a.student_id
  CROSS JOIN m
  WHERE current_date > m.run_day
    AND a.billing_month = m.month
    AND a.transaction_type = 'monthly_charge' AND a.source = 'automatic'
    AND trim(s.tuition_rank) = ANY (public.tuition_auto_credit_ranks())
    AND NOT EXISTS (SELECT 1 FROM public.tuition_transactions p
                    WHERE p.student_id = a.student_id AND p.billing_month = m.month
                      AND p.transaction_type = 'automatic_payment')

  UNION ALL
  -- 5. automatic credit for a student whose CURRENT rank is not approved
  SELECT 'unauthorized_auto_credit', 'warning', p.student_id,
         'זיכוי אוטומטי ' || p.amount::text || ' ' || p.currency || ' אך הדירוג הנוכחי: ' || coalesce(s.tuition_rank, '—')
  FROM active p
  JOIN public.students s ON s.id = p.student_id
  CROSS JOIN m
  WHERE p.billing_month = m.month
    AND p.transaction_type = 'automatic_payment'
    AND coalesce(trim(s.tuition_rank), '') <> ALL (public.tuition_auto_credit_ranks())

  UNION ALL
  -- 6. automatic credit that does not mirror the charge (amount / currency / no charge)
  SELECT 'credit_charge_mismatch', 'warning', p.student_id,
         'זיכוי ' || p.amount::text || ' ' || p.currency || ' מול חיוב ' ||
         coalesce(c.amount::text || ' ' || c.currency, 'לא קיים')
  FROM active p
  CROSS JOIN m
  LEFT JOIN active c
    ON c.student_id = p.student_id AND c.billing_month = p.billing_month
   AND c.transaction_type = 'monthly_charge' AND c.source = 'automatic'
  WHERE p.billing_month = m.month
    AND p.transaction_type = 'automatic_payment'
    AND (c.id IS NULL OR c.amount <> -p.amount OR c.currency <> p.currency)

  UNION ALL
  -- 7. start date removed (audit trail) in the last 45 days
  SELECT 'start_date_cleared', 'critical', au.student_id,
         'tuition_start_date נמחק (' || coalesce(au.old_value, '') || ' → NULL) ב-' ||
         to_char(au.changed_at, 'YYYY-MM-DD HH24:MI') || ' ע"י ' || au.db_role
  FROM public.student_tuition_audit au
  WHERE au.field = 'tuition_start_date' AND au.operation = 'UPDATE'
    AND au.new_value IS NULL AND au.old_value IS NOT NULL
    AND au.changed_at > now() - interval '45 days'

  UNION ALL
  -- 8. paying student (valid tuition + currency) with NULL start date — will not be charged
  SELECT 'paying_student_without_start_date', 'critical', s.id,
         'שכ"ל ' || trim(s.tuition) || ' ' || s.tuition_currency || ' ללא תאריך תחילת גבייה' ||
         CASE WHEN EXISTS (SELECT 1 FROM public.tuition_transactions t
                           WHERE t.student_id = s.id AND t.transaction_type = 'monthly_charge')
              THEN ' — חויב בעבר (חשד למחיקה)' ELSE '' END
  FROM public.students s
  WHERE public.tuition_amount(s.tuition) > 0
    AND s.tuition_currency IN ('ILS', 'USD')
    AND s.tuition_start_date IS NULL

  UNION ALL
  -- 9. tuition value the function cannot parse (student silently skipped)
  SELECT 'unparseable_tuition', 'warning', s.id,
         'ערך שכ"ל לא מספרי: "' || s.tuition || '"'
  FROM public.students s
  WHERE s.tuition IS NOT NULL AND trim(s.tuition) <> ''
    AND public.tuition_amount(s.tuition) IS NULL

  UNION ALL
  -- 10. transactions in a currency different from the student's — hidden from tuition_balances
  SELECT 'currency_mismatch_hidden_from_balance', 'warning', t.student_id,
         count(*)::text || ' תנועות ב-' || t.currency || ' בעוד מטבע התלמיד ' || coalesce(s.tuition_currency, 'NULL') ||
         ' — אינן נספרות ביתרה'
  FROM active t
  JOIN public.students s ON s.id = t.student_id
  WHERE s.tuition_currency IS DISTINCT FROM t.currency
  GROUP BY t.student_id, t.currency, s.tuition_currency

  UNION ALL
  -- 11. month-over-month drop/increase of > 10% in charged students
  SELECT 'charged_count_changed', 'warning', NULL::uuid,
         'מחויבים ב-' || m.month::text || ': ' || cur.n::text || ' לעומת ' || prev.n::text || ' בחודש הקודם'
  FROM m,
       LATERAL (SELECT count(*) AS n FROM active a WHERE a.billing_month = m.month
                AND a.transaction_type = 'monthly_charge') cur,
       LATERAL (SELECT count(*) AS n FROM active a WHERE a.billing_month = m.prev_month
                AND a.transaction_type = 'monthly_charge') prev
  WHERE current_date > m.run_day
    AND prev.n > 0
    AND abs(cur.n - prev.n)::numeric / prev.n > 0.10;
$$;

REVOKE ALL     ON FUNCTION public.tuition_health_check(date) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.tuition_health_check(date) TO authenticated, service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION (read-only)
-- ════════════════════════════════════════════════════════════
/*
select tgname, tgenabled from pg_trigger
 where tgrelid = 'public.students'::regclass and not tgisinternal;
-- expected: trg_students_tuition_audit, trg_students_protect_start_date (+ students_updated_at)

select public.tuition_auto_credit_ranks();
select * from public.tuition_health_check();

select indexname, indexdef from pg_indexes
 where tablename = 'tuition_transactions' and indexname in ('uq_auto_monthly_charge','uq_auto_payment');
-- expected: both present (they are what make the cron and the recovery idempotent)
*/

-- ════════════════════════════════════════════════════════════
-- ROLLBACK PLAN (run manually, only if needed)
-- ════════════════════════════════════════════════════════════
/*
BEGIN;
DROP TRIGGER  IF EXISTS trg_students_protect_start_date ON public.students;
DROP TRIGGER  IF EXISTS trg_students_tuition_audit      ON public.students;
DROP FUNCTION IF EXISTS public.protect_tuition_start_date();
DROP FUNCTION IF EXISTS public.log_student_tuition_changes();
DROP FUNCTION IF EXISTS public.tuition_health_check(date);
-- Restore the previous process_monthly_tuition: paste the exact definition saved
-- BEFORE the migration (PROD-Q1 in supabase/recovery/prod_readonly_queries.sql).
-- Restore run_tuition_backfill from supabase/tuition_backfill.sql only if truly needed.
-- Tables below hold audit data — keep them unless explicitly told otherwise:
--   student_tuition_audit, tuition_processing_runs, tuition_recovery_log
-- DROP FUNCTION IF EXISTS public.tuition_auto_credit_ranks();  -- only after restoring process_monthly_tuition
COMMIT;
*/
