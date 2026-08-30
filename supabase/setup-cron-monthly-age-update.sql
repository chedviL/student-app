-- ============================
-- SETUP: Monthly Age Update Cron Job
-- This file sets up automatic monthly age increments
-- ============================

-- Enable pg_cron extension (if not already enabled)
-- NOTE: You need to run this in Supabase dashboard as a user with superuser access
-- Go to SQL Editor → type this query → click RUN

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the cron job
-- This runs on the 1st of each month at 00:00 UTC
-- Format: minute hour day month day-of-week
SELECT cron.schedule(
  'monthly-age-update',  -- job name
  '0 0 1 * *',           -- at 00:00 on day 1 of every month
  'SELECT public.process_monthly_age_update();'
);

-- View scheduled jobs:
-- SELECT * FROM cron.job;

-- To disable the job (if needed):
-- SELECT cron.unschedule('monthly-age-update');

-- To view job execution logs:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
