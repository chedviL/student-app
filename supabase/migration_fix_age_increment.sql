-- ============================
-- MIGRATION: Fix age increment logic
-- Age format: years.months (e.g., 17.9, 17.10, 18)
-- ============================

-- 1. Create audit table for idempotent monthly updates
CREATE TABLE IF NOT EXISTS public.monthly_age_updates (
  id bigserial primary key,
  update_date date not null,
  student_id uuid not null,
  old_age text,
  new_age text,
  created_at timestamptz default now(),
  unique(update_date, student_id)  -- idempotent: once per student per month
);

-- 2. Create function to increment age correctly
-- Input: age as text (e.g., "17.9", "17.10", "18")
-- Output: age incremented by one month following rules
CREATE OR REPLACE FUNCTION public.increment_age_by_month(current_age text)
RETURNS text AS $$
DECLARE
  v_years int;
  v_months int;
  v_dot_pos int;
  v_new_years int;
  v_new_months int;
BEGIN
  -- Handle NULL, empty, or invalid input
  IF current_age IS NULL OR current_age = '' THEN
    RETURN current_age;
  END IF;

  -- Parse age into years and months
  v_dot_pos := position('.' in current_age);
  
  IF v_dot_pos = 0 THEN
    -- No dot: age is just years, e.g., "18"
    v_years := CAST(current_age AS int);
    v_months := 0;
  ELSE
    -- Has dot: e.g., "17.9" or "17.10"
    v_years := CAST(substring(current_age, 1, v_dot_pos - 1) AS int);
    v_months := CAST(substring(current_age, v_dot_pos + 1) AS int);
  END IF;

  -- Increment month
  v_new_months := v_months + 1;
  v_new_years := v_years;

  -- Rollover: months = 12 → years += 1, months = 0
  IF v_new_months > 11 THEN
    v_new_years := v_new_years + 1;
    v_new_months := 0;
  END IF;

  -- Format output
  IF v_new_months = 0 THEN
    -- Just years, e.g., "18"
    RETURN v_new_years::text;
  ELSE
    -- Years and months, e.g., "17.10"
    RETURN v_new_years::text || '.' || v_new_months::text;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Create function to update ages for current month
-- This is idempotent: can be called multiple times, only updates once per month
CREATE OR REPLACE FUNCTION public.process_monthly_age_update()
RETURNS TABLE(
  student_id uuid,
  old_age text,
  new_age text,
  updated boolean
) AS $$
DECLARE
  v_current_month date := date_trunc('month', now())::date;
  v_row record;
BEGIN
  -- Loop through all students with valid ages that haven't been updated this month
  FOR v_row IN
    SELECT s.id, s.age
    FROM public.students s
    WHERE s.age IS NOT NULL 
      AND s.age != ''
      AND NOT EXISTS (
        SELECT 1 FROM public.monthly_age_updates mau
        WHERE mau.student_id = s.id
          AND mau.update_date = v_current_month
      )
  LOOP
    INSERT INTO public.monthly_age_updates (
      update_date, student_id, old_age, new_age
    ) VALUES (
      v_current_month,
      v_row.id,
      v_row.age,
      public.increment_age_by_month(v_row.age)
    );

    -- Update the student record
    UPDATE public.students
    SET age = public.increment_age_by_month(v_row.age),
        updated_at = now()
    WHERE id = v_row.id;

    RETURN QUERY SELECT
      v_row.id,
      v_row.age,
      public.increment_age_by_month(v_row.age),
      true;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Add comment
COMMENT ON TABLE public.monthly_age_updates IS 'Audit trail for idempotent monthly age increments. Each student can only be updated once per calendar month.';
COMMENT ON FUNCTION public.increment_age_by_month(text) IS 'Correctly increments age by one month. Format: years.months (e.g., 17.9 → 17.10 → 17.11 → 18)';
COMMENT ON FUNCTION public.process_monthly_age_update() IS 'Idempotent function to increment all student ages by one month. Safe to call multiple times — only updates once per month per student.';
