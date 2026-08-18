-- ============================================================
-- MIGRATION v4: Audit, Cancellation, Profiles
-- Run in Supabase SQL Editor as postgres role
-- ============================================================
-- Transactional: BEGIN ... COMMIT
-- Rollback plan: see end of file
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- SECTION 1: Add audit columns to tuition_transactions
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.tuition_transactions
  ADD COLUMN IF NOT EXISTS created_by          uuid        DEFAULT NULL
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at        timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by        uuid        DEFAULT NULL
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text        DEFAULT NULL;

-- Partial index: fast lookup of active transactions
CREATE INDEX IF NOT EXISTS idx_tuition_txn_active
  ON public.tuition_transactions(student_id, billing_month)
  WHERE cancelled_at IS NULL;

-- ════════════════════════════════════════════════════════════
-- SECTION 2: RPC add_manual_transaction
-- created_by = auth.uid() server-side, cannot be forged
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.add_manual_transaction(
  p_student_id       uuid,
  p_billing_month    date,
  p_transaction_date date,
  p_amount           numeric(12,2),
  p_currency         text,
  p_transaction_type text,
  p_note             text DEFAULT NULL
)
RETURNS public.tuition_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.tuition_transactions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Explicit NULL checks for all required fields
  IF p_student_id       IS NULL THEN RAISE EXCEPTION 'student_id is required';       END IF;
  IF p_billing_month    IS NULL THEN RAISE EXCEPTION 'billing_month is required';    END IF;
  IF p_transaction_date IS NULL THEN RAISE EXCEPTION 'transaction_date is required'; END IF;
  IF p_amount           IS NULL THEN RAISE EXCEPTION 'amount is required';           END IF;
  IF p_currency         IS NULL THEN RAISE EXCEPTION 'currency is required';         END IF;
  IF p_transaction_type IS NULL THEN RAISE EXCEPTION 'transaction_type is required'; END IF;

  IF p_currency NOT IN ('ILS', 'USD') THEN
    RAISE EXCEPTION 'invalid currency: %', p_currency;
  END IF;

  IF p_transaction_type NOT IN ('manual_payment', 'manual_charge', 'adjustment') THEN
    RAISE EXCEPTION 'invalid transaction_type for manual entry: %', p_transaction_type;
  END IF;

  IF p_amount = 0 THEN
    RAISE EXCEPTION 'amount cannot be zero';
  END IF;

  IF p_transaction_type = 'manual_payment' AND p_amount < 0 THEN
    RAISE EXCEPTION 'manual_payment amount must be positive';
  END IF;
  IF p_transaction_type = 'manual_charge' AND p_amount > 0 THEN
    RAISE EXCEPTION 'manual_charge amount must be negative';
  END IF;
  -- adjustment: any non-zero sign is valid

  INSERT INTO public.tuition_transactions
    (student_id, billing_month, transaction_date, amount, currency,
     transaction_type, source, note, created_by)
  VALUES
    (p_student_id, p_billing_month, p_transaction_date, p_amount, p_currency,
     p_transaction_type, 'manual', p_note, auth.uid())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL     ON FUNCTION public.add_manual_transaction(uuid,date,date,numeric(12,2),text,text,text) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.add_manual_transaction(uuid,date,date,numeric(12,2),text,text,text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.add_manual_transaction(uuid,date,date,numeric(12,2),text,text,text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.add_manual_transaction(uuid,date,date,numeric(12,2),text,text,text) TO service_role;

-- ════════════════════════════════════════════════════════════
-- SECTION 3: RPC cancel_transaction
-- Atomic double-cancel protection
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.cancel_transaction(
  p_transaction_id   uuid,
  p_reason           text
)
RETURNS public.tuition_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row public.tuition_transactions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'cancellation_reason is required';
  END IF;

  -- Atomic: only succeeds if row exists AND not yet cancelled
  UPDATE public.tuition_transactions
  SET
    cancelled_at        = now(),
    cancelled_by        = auth.uid(),
    cancellation_reason = TRIM(p_reason)
  WHERE id            = p_transaction_id
    AND cancelled_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.tuition_transactions WHERE id = p_transaction_id
    ) THEN
      RAISE EXCEPTION 'transaction already cancelled';
    ELSE
      RAISE EXCEPTION 'transaction not found';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL     ON FUNCTION public.cancel_transaction(uuid,text) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.cancel_transaction(uuid,text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.cancel_transaction(uuid,text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cancel_transaction(uuid,text) TO service_role;

-- ════════════════════════════════════════════════════════════
-- SECTION 4: RPC update_manual_transaction
-- Manual transactions only, effective pair validation
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_manual_transaction(
  p_transaction_id   uuid,
  p_amount           numeric(12,2) DEFAULT NULL,
  p_transaction_date date          DEFAULT NULL,
  p_billing_month    date          DEFAULT NULL,
  p_transaction_type text          DEFAULT NULL,
  p_note             text          DEFAULT NULL
)
RETURNS public.tuition_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_amount   numeric(12,2);
  v_current_type     text;
  v_current_source   text;
  v_effective_amount numeric(12,2);
  v_effective_type   text;
  v_row              public.tuition_transactions;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Fetch current row (active only)
  SELECT amount, transaction_type, source
  INTO   v_current_amount, v_current_type, v_current_source
  FROM   public.tuition_transactions
  WHERE  id           = p_transaction_id
    AND  cancelled_at IS NULL;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1 FROM public.tuition_transactions WHERE id = p_transaction_id
    ) THEN
      RAISE EXCEPTION 'cannot edit a cancelled transaction';
    ELSE
      RAISE EXCEPTION 'transaction not found';
    END IF;
  END IF;

  -- Manual only
  IF v_current_source <> 'manual' THEN
    RAISE EXCEPTION 'cannot edit an automatic transaction (source = %)', v_current_source;
  END IF;
  IF v_current_type IN ('monthly_charge', 'automatic_payment') THEN
    RAISE EXCEPTION 'cannot edit transaction of type %', v_current_type;
  END IF;

  -- Validate new type if provided
  IF p_transaction_type IS NOT NULL
     AND p_transaction_type NOT IN ('manual_payment', 'manual_charge', 'adjustment') THEN
    RAISE EXCEPTION 'invalid transaction_type: %', p_transaction_type;
  END IF;

  -- Effective values
  v_effective_amount := COALESCE(p_amount, v_current_amount);
  v_effective_type   := COALESCE(p_transaction_type, v_current_type);

  -- Validate effective pair
  IF v_effective_amount = 0 THEN
    RAISE EXCEPTION 'amount cannot be zero';
  END IF;
  IF v_effective_type = 'manual_payment' AND v_effective_amount < 0 THEN
    RAISE EXCEPTION 'manual_payment amount must be positive';
  END IF;
  IF v_effective_type = 'manual_charge' AND v_effective_amount > 0 THEN
    RAISE EXCEPTION 'manual_charge amount must be negative';
  END IF;

  UPDATE public.tuition_transactions SET
    amount           = v_effective_amount,
    transaction_date = COALESCE(p_transaction_date, transaction_date),
    billing_month    = COALESCE(p_billing_month,    billing_month),
    transaction_type = v_effective_type,
    note             = CASE WHEN p_note IS NOT NULL THEN p_note ELSE note END
  WHERE id           = p_transaction_id
    AND cancelled_at IS NULL
    AND source       = 'manual'
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL     ON FUNCTION public.update_manual_transaction(uuid,numeric(12,2),date,date,text,text) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.update_manual_transaction(uuid,numeric(12,2),date,date,text,text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_manual_transaction(uuid,numeric(12,2),date,date,text,text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.update_manual_transaction(uuid,numeric(12,2),date,date,text,text) TO service_role;

-- ════════════════════════════════════════════════════════════
-- SECTION 5: profiles table
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid        PRIMARY KEY
                           REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL DEFAULT '',
  role         text        NOT NULL DEFAULT 'secretary'
                           CHECK (role IN ('admin', 'secretary', 'readonly')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated can read rows (column-level grant restricts columns)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT, UPDATE, DELETE policies for clients
-- Writes go through trigger (INSERT) or RPC (UPDATE display_name)

-- Column-level privileges: revoke all, then grant only id + display_name
REVOKE ALL ON TABLE public.profiles FROM anon;
REVOKE ALL ON TABLE public.profiles FROM authenticated;
GRANT SELECT (id, display_name) ON TABLE public.profiles TO authenticated;
-- service_role retains full access (bypasses grants)

-- ════════════════════════════════════════════════════════════
-- SECTION 6: handle_new_user trigger
-- Auto-create profile on new auth user — no exception swallowing
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop and recreate to ensure idempotency
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- SECTION 7: RPC update_display_name
-- Only way for a user to update their own display_name
-- Cannot change role
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_display_name(p_display_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_display_name IS NULL OR TRIM(p_display_name) = '' THEN
    RAISE EXCEPTION 'display_name cannot be empty';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (auth.uid(), TRIM(p_display_name))
  ON CONFLICT (id) DO UPDATE SET display_name = TRIM(p_display_name);
END;
$$;

REVOKE ALL     ON FUNCTION public.update_display_name(text) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.update_display_name(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_display_name(text) TO authenticated;

-- ════════════════════════════════════════════════════════════
-- SECTION 8: Backfill profiles for existing auth users
-- ════════════════════════════════════════════════════════════

INSERT INTO public.profiles (id, display_name)
SELECT
  id,
  COALESCE(
    NULLIF(TRIM(raw_user_meta_data->>'display_name'), ''),
    SPLIT_PART(email, '@', 1)
  )
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- SECTION 9: Lock down tuition_transactions direct writes
-- ════════════════════════════════════════════════════════════

-- Drop existing write policies
DROP POLICY IF EXISTS "tuition_txn_insert" ON public.tuition_transactions;
DROP POLICY IF EXISTS "tuition_txn_update" ON public.tuition_transactions;
DROP POLICY IF EXISTS "tuition_txn_delete" ON public.tuition_transactions;

-- Revoke table-level write privileges
REVOKE INSERT, UPDATE, DELETE ON public.tuition_transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.tuition_transactions FROM anon;

-- SELECT remains for authenticated
-- Service role bypasses RLS/grants (test cleanup, process_monthly_tuition)

-- ════════════════════════════════════════════════════════════
-- SECTION 10: Lock down system RPCs
-- Cron runs as postgres internal role — not affected by these REVOKEs
-- ════════════════════════════════════════════════════════════

REVOKE ALL     ON FUNCTION public.process_monthly_tuition(date) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.process_monthly_tuition(date) FROM anon;
REVOKE ALL     ON FUNCTION public.process_monthly_tuition(date) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.process_monthly_tuition(date) TO service_role;

REVOKE ALL     ON FUNCTION public.run_tuition_backfill() FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.run_tuition_backfill() FROM anon;
REVOKE ALL     ON FUNCTION public.run_tuition_backfill() FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.run_tuition_backfill() TO service_role;

-- ════════════════════════════════════════════════════════════
-- SECTION 11: Updated views with security_invoker
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.tuition_balances
WITH (security_invoker = true)
AS
SELECT
  s.id                                                              AS student_id,
  s.tuition_currency                                                AS currency,
  COALESCE(
    SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL),
    0
  )                                                                 AS current_balance,
  CASE
    WHEN s.tuition_currency IS NULL THEN 'no_currency'
    WHEN COALESCE(
      SUM(t.amount) FILTER (WHERE t.cancelled_at IS NULL), 0
    ) < 0                           THEN 'debt'
    ELSE                                 'ok'
  END                                                               AS status
FROM public.students s
LEFT JOIN public.tuition_transactions t
  ON  t.student_id = s.id
  AND t.currency   = s.tuition_currency
GROUP BY s.id, s.tuition_currency;

CREATE OR REPLACE VIEW public.tuition_monthly_history
WITH (security_invoker = true)
AS
SELECT
  t.student_id,
  t.currency,
  t.billing_month,
  SUM(t.amount) FILTER (WHERE t.amount < 0)   AS charges,
  SUM(t.amount) FILTER (WHERE t.amount > 0)   AS credits,
  SUM(t.amount)                               AS monthly_total,
  SUM(SUM(t.amount)) OVER (
    PARTITION BY t.student_id, t.currency
    ORDER BY t.billing_month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                                           AS balance_after_month,
  COALESCE(
    (SELECT s.last_name || ' ' || COALESCE(s.first_name, '')
     FROM public.students s WHERE s.id = t.student_id),
    (SELECT a.last_name || ' ' || COALESCE(a.first_name, '')
     FROM public.alumni   a WHERE a.id = t.student_id)
  )                                           AS student_name
FROM public.tuition_transactions t
WHERE t.cancelled_at IS NULL
GROUP BY t.student_id, t.currency, t.billing_month;

COMMIT;

-- ════════════════════════════════════════════════════════════
-- ROLLBACK PLAN (run if needed, outside the transaction)
-- ════════════════════════════════════════════════════════════
/*
-- Restore write policies on tuition_transactions
CREATE POLICY "tuition_txn_insert" ON public.tuition_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tuition_txn_update" ON public.tuition_transactions FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "tuition_txn_delete" ON public.tuition_transactions FOR DELETE USING (auth.role() = 'authenticated');
GRANT INSERT, UPDATE, DELETE ON public.tuition_transactions TO authenticated;

-- Restore system RPC grants
GRANT EXECUTE ON FUNCTION public.process_monthly_tuition(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_tuition_backfill() TO authenticated;

-- Drop new RPCs
DROP FUNCTION IF EXISTS public.update_manual_transaction(uuid,numeric(12,2),date,date,text,text);
DROP FUNCTION IF EXISTS public.cancel_transaction(uuid,text);
DROP FUNCTION IF EXISTS public.add_manual_transaction(uuid,date,date,numeric(12,2),text,text,text);
DROP FUNCTION IF EXISTS public.update_display_name(text);

-- Drop trigger
DROP TRIGGER  IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Drop profiles
DROP TABLE IF EXISTS public.profiles;

-- Remove audit columns
DROP INDEX    IF EXISTS idx_tuition_txn_active;
ALTER TABLE public.tuition_transactions
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS cancelled_at,
  DROP COLUMN IF EXISTS cancelled_by,
  DROP COLUMN IF EXISTS cancellation_reason;

-- Restore views (paste original CREATE OR REPLACE VIEW from tuition_migration.sql)
*/
