import { createClient } from '@supabase/supabase-js';
import { assertDestructiveTestsAllowed } from '../guards/destructiveGuard';
import { ALL_FIXTURE_IDS, FIXTURES } from '../fixtures/fixtures';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load .env.test.local
const envPath = path.resolve(process.cwd(), '.env.test.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const url = process.env.SUPABASE_TEST_URL!;
const serviceKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY!;

if (!url || !serviceKey || !anonKey) {
  throw new Error(
    'Missing SUPABASE_TEST_URL / SUPABASE_TEST_SERVICE_ROLE_KEY / SUPABASE_TEST_ANON_KEY in .env.test.local'
  );
}

/** Service-role client — for setup/cleanup only */
export const adminClient = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Anon client — for RLS tests */
export const anonClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Authenticated client — signs in with test credentials */
export async function getAuthClient() {
  const email = process.env.SUPABASE_TEST_USER_EMAIL!;
  const password = process.env.SUPABASE_TEST_USER_PASSWORD!;
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Test auth failed: ${error.message}`);
  return client;
}

/** Remove all AUTOTEST_ data — safe to call multiple times */
export async function cleanupFixtures(): Promise<void> {
  // Delete transactions first (no FK but good practice)
  await adminClient
    .from('tuition_transactions')
    .delete()
    .in('student_id', ALL_FIXTURE_IDS);

  // Delete from alumni (in case a graduate test ran)
  await adminClient
    .from('alumni')
    .delete()
    .in('id', ALL_FIXTURE_IDS);

  // Delete from students
  await adminClient
    .from('students')
    .delete()
    .in('id', ALL_FIXTURE_IDS);
}

/** Insert all fixture students */
export async function seedFixtures(): Promise<void> {
  assertDestructiveTestsAllowed();
  await cleanupFixtures();

  const rows = Object.values(FIXTURES).map((f) => ({ ...f }));
  const { error } = await adminClient.from('students').insert(rows);
  if (error) throw new Error(`Seed failed: ${error.message}`);
}

/** Global setup — runs once before all integration tests */
export async function setup() {
  assertDestructiveTestsAllowed();
  await seedFixtures();
}

/** Global teardown — runs once after all integration tests */
export async function teardown() {
  await cleanupFixtures();
}
