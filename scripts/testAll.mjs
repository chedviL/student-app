#!/usr/bin/env node
/**
 * test:all — runs the full test suite in order.
 * Cleanup runs in finally so it always executes even on failure.
 *
 * Steps:
 *   1. Destructive guard check
 *   2. TypeScript
 *   3. Unit tests
 *   4. Integration tests (if ALLOW_DESTRUCTIVE_TESTS=true)
 *   5. Build
 *   6. E2E
 *   7. Cleanup (always)
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();
const results = {
  typescript: '⏳',
  unit: '⏳',
  integration: '⏳ SKIPPED',
  build: '⏳',
  e2e: '⏳ SKIPPED',
};

// Load .env.test.local
const envFile = resolve(ROOT, '.env.test.local');
if (existsSync(envFile)) {
  const lines = readFileSync(envFile, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const allowDestructive = process.env.ALLOW_DESTRUCTIVE_TESTS === 'true';
const expectedRef = process.env.EXPECTED_TEST_PROJECT_REF ?? '';
const actualUrl = process.env.SUPABASE_TEST_URL ?? '';

function run(cmd, label) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
    return true;
  } catch {
    console.error(`\n❌ ${label} FAILED\n`);
    return false;
  }
}

let anyFailed = false;

try {
  // ── 1. Destructive guard ──────────────────────────────────────────────────
  if (allowDestructive && expectedRef && !actualUrl.includes(expectedRef)) {
    console.error('\n🛑 Destructive tests blocked: wrong Supabase project or permission flag.\n');
    process.exit(1);
  }

  // ── 2. TypeScript ─────────────────────────────────────────────────────────
  console.log('\n── TypeScript ──────────────────────────────────────────────');
  if (run('npx tsc --noEmit', 'TypeScript')) {
    results.typescript = '✅ PASS';
  } else {
    results.typescript = '❌ FAIL';
    anyFailed = true;
  }

  // ── 3. Unit tests ─────────────────────────────────────────────────────────
  console.log('\n── Unit Tests ──────────────────────────────────────────────');
  if (run('npx vitest run --config vitest.config.ts', 'Unit Tests')) {
    results.unit = '✅ PASS';
  } else {
    results.unit = '❌ FAIL';
    anyFailed = true;
  }

  // ── 4. Integration tests ──────────────────────────────────────────────────
  if (allowDestructive) {
    console.log('\n── Integration Tests ───────────────────────────────────────');
    if (run('npx vitest run --config vitest.integration.config.ts', 'Integration Tests')) {
      results.integration = '✅ PASS';
    } else {
      results.integration = '❌ FAIL';
      anyFailed = true;
    }
  } else {
    results.integration = '⏭  SKIPPED (set ALLOW_DESTRUCTIVE_TESTS=true to enable)';
  }

  // ── 5. Build ──────────────────────────────────────────────────────────────
  console.log('\n── Build ───────────────────────────────────────────────────');
  if (run('npm run build', 'Build')) {
    results.build = '✅ PASS';
  } else {
    results.build = '❌ FAIL';
    anyFailed = true;
  }

  // ── 6. E2E ────────────────────────────────────────────────────────────────
  const e2eEmail = process.env.E2E_TEST_EMAIL ?? '';
  if (e2eEmail) {
    console.log('\n── E2E Tests ───────────────────────────────────────────────');
    if (run('npx playwright test', 'E2E')) {
      results.e2e = '✅ PASS';
    } else {
      results.e2e = '❌ FAIL';
      anyFailed = true;
    }
  } else {
    results.e2e = '⏭  SKIPPED (set E2E_TEST_EMAIL in .env.test.local to enable)';
  }

} finally {
  // ── 7. Report ─────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                     TEST RESULT                          ║
╠══════════════════════════════════════════════════════════╣
║  TypeScript:    ${results.typescript.padEnd(40)}║
║  Unit:          ${results.unit.padEnd(40)}║
║  Integration:   ${results.integration.padEnd(40)}║
║  Build:         ${results.build.padEnd(40)}║
║  E2E:           ${results.e2e.padEnd(40)}║
╠══════════════════════════════════════════════════════════╣
║  PENDING / NOT IMPLEMENTED:                              ║
║  - Student photos (photo_path, Storage bucket)           ║
║  - Import HTML parser tests (import-students.html)       ║
╚══════════════════════════════════════════════════════════╝
`);

  if (anyFailed) {
    process.exit(1);
  }
}
