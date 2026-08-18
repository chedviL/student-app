/**
 * Check process_monthly_tuition EXECUTE grants
 * using information_schema via PostgREST RPC workaround
 */
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test.local') });

const client = createClient(
  process.env.SUPABASE_TEST_URL,
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// 1. Verify process_monthly_tuition works with service role
console.log('--- Testing process_monthly_tuition via service_role ---');
const { data: procData, error: procErr } = await client.rpc('process_monthly_tuition', {
  p_billing_month: '2099-01-01', // far future — no eligible students, safe
});
if (procErr) {
  console.log('process_monthly_tuition error:', procErr.message);
} else {
  console.log('process_monthly_tuition: OK (returned', (procData ?? []).length, 'rows)');
}

// 2. Test with anon key to check current grant status
console.log('\n--- Testing process_monthly_tuition via anon ---');
const { createClient: cc } = await import('@supabase/supabase-js');
const anonClient = cc(
  process.env.SUPABASE_TEST_URL,
  process.env.SUPABASE_TEST_ANON_KEY,
  { auth: { persistSession: false } }
);
const { error: anonErr } = await anonClient.rpc('process_monthly_tuition', {
  p_billing_month: '2099-01-01',
});
if (anonErr) {
  console.log('anon process_monthly_tuition: BLOCKED -', anonErr.message);
} else {
  console.log('anon process_monthly_tuition: ALLOWED (needs to be blocked)');
}

// 3. Test run_tuition_backfill via anon
console.log('\n--- Testing run_tuition_backfill via anon ---');
const { error: backfillErr } = await anonClient.rpc('run_tuition_backfill');
if (backfillErr) {
  console.log('anon run_tuition_backfill: BLOCKED -', backfillErr.message);
} else {
  console.log('anon run_tuition_backfill: ALLOWED (needs to be blocked)');
}

console.log('\nNote: cron.job table not accessible via PostgREST.');
console.log('Cron runs as postgres/supabase internal role — not affected by REVOKE on authenticated/anon.');
console.log('GRANT EXECUTE TO service_role ensures integration tests keep working.');
