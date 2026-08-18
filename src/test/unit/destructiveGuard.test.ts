import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { assertDestructiveTestsAllowed } from '../guards/destructiveGuard';

describe('assertDestructiveTestsAllowed', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ALLOW_DESTRUCTIVE_TESTS;
    delete process.env.EXPECTED_TEST_PROJECT_REF;
    delete process.env.SUPABASE_TEST_URL;
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('throws when ALLOW_DESTRUCTIVE_TESTS is not set', () => {
    expect(() => assertDestructiveTestsAllowed()).toThrow(
      'Destructive tests blocked: wrong Supabase project or permission flag.'
    );
  });

  it('throws when ALLOW_DESTRUCTIVE_TESTS is false', () => {
    process.env.ALLOW_DESTRUCTIVE_TESTS = 'false';
    expect(() => assertDestructiveTestsAllowed()).toThrow(
      'Destructive tests blocked: wrong Supabase project or permission flag.'
    );
  });

  it('passes when ALLOW_DESTRUCTIVE_TESTS=true and no project ref check', () => {
    process.env.ALLOW_DESTRUCTIVE_TESTS = 'true';
    expect(() => assertDestructiveTestsAllowed()).not.toThrow();
  });

  it('passes when project ref matches URL', () => {
    process.env.ALLOW_DESTRUCTIVE_TESTS = 'true';
    process.env.EXPECTED_TEST_PROJECT_REF = 'myproject';
    process.env.SUPABASE_TEST_URL = 'https://myproject.supabase.co';
    expect(() => assertDestructiveTestsAllowed()).not.toThrow();
  });

  it('throws when project ref does NOT match URL', () => {
    process.env.ALLOW_DESTRUCTIVE_TESTS = 'true';
    process.env.EXPECTED_TEST_PROJECT_REF = 'myproject';
    process.env.SUPABASE_TEST_URL = 'https://otherproject.supabase.co';
    expect(() => assertDestructiveTestsAllowed()).toThrow(
      'Destructive tests blocked: wrong Supabase project or permission flag.'
    );
  });

  it('error message never contains service role key', () => {
    process.env.ALLOW_DESTRUCTIVE_TESTS = 'false';
    process.env.SUPABASE_TEST_SERVICE_ROLE_KEY = 'super-secret-key';
    let msg = '';
    try { assertDestructiveTestsAllowed(); } catch (e) { msg = String(e); }
    expect(msg).not.toContain('super-secret-key');
  });
});
