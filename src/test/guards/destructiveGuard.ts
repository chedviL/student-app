/**
 * DESTRUCTIVE GUARD
 * Must be called before any test that writes/deletes data in Supabase.
 * Reads from process.env (not VITE_ — never exposed to browser).
 */
export function assertDestructiveTestsAllowed(): void {
  const allowed = process.env.ALLOW_DESTRUCTIVE_TESTS;
  const expectedRef = process.env.EXPECTED_TEST_PROJECT_REF;
  const actualUrl = process.env.SUPABASE_TEST_URL ?? '';

  if (allowed !== 'true') {
    throw new Error(
      'Destructive tests blocked: wrong Supabase project or permission flag.\n' +
      'Set ALLOW_DESTRUCTIVE_TESTS=true in .env.test.local to proceed.'
    );
  }

  if (expectedRef && !actualUrl.includes(expectedRef)) {
    throw new Error(
      'Destructive tests blocked: wrong Supabase project or permission flag.\n' +
      `Expected project ref "${expectedRef}" not found in SUPABASE_TEST_URL.`
    );
  }
}
