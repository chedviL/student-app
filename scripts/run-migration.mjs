/**
 * Runs migration_v4 via Supabase Management API
 * Requires SUPABASE_ACCESS_TOKEN in env
 */
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env.test.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env.admin') });

const projectRef = process.env.EXPECTED_TEST_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef) { console.error('MISSING EXPECTED_TEST_PROJECT_REF'); process.exit(1); }
if (!accessToken) { console.error('MISSING SUPABASE_ACCESS_TOKEN in .env.admin'); process.exit(1); }

const sql = readFileSync(
  path.resolve(__dirname, '..', 'supabase', 'migration_v4_audit_cancellation_profiles.sql'),
  'utf-8'
);

const resp = await fetch(
  `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
);

const body = await resp.text();
console.log('Status:', resp.status);
if (resp.ok) {
  console.log('Migration: SUCCESS');
} else {
  console.log('Migration: FAILED');
  console.log('Body:', body.slice(0, 1000));
  process.exit(1);
}
