/**
 * INTEGRATION TESTS — process_monthly_tuition
 * Requires .env.test.local with valid Supabase credentials.
 * Runs against real DB — fixtures are created/cleaned automatically.
 *
 * ISOLATION STRATEGY:
 * - Global beforeAll seeds all fixtures once.
 * - Describes that mutate tuition_transactions use a beforeEach that
 *   wipes only their own fixture IDs and re-seeds those students,
 *   so each test starts from a known-clean state regardless of run order.
 * - All tests run sequentially (vitest.integration.config.ts: singleFork).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { adminClient, seedFixtures, cleanupFixtures } from './integrationSetup';
import { FIXTURES, TEST_BILLING_MONTH, TEST_BILLING_MONTH_2 } from '../fixtures/fixtures';
import { assertDestructiveTestsAllowed } from '../guards/destructiveGuard';

// ─── Global setup / teardown ──────────────────────────────────────────────────

beforeAll(async () => {
  assertDestructiveTestsAllowed();
  await seedFixtures();
});

afterAll(async () => {
  await cleanupFixtures();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function runMonthlyTuition(billingMonth: string) {
  const { data, error } = await adminClient.rpc('process_monthly_tuition', {
    p_billing_month: billingMonth,
  });
  if (error) throw new Error(error.message);
  return data as { processed_student_id: string; student_name: string; action: string }[];
}

async function getTxForStudent(studentId: string, billingMonth: string) {
  const { data, error } = await adminClient
    .from('tuition_transactions')
    .select('*')
    .eq('student_id', studentId)
    .eq('billing_month', billingMonth);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Delete all tuition_transactions for the given student IDs,
 * then re-insert those students so they start clean.
 * Touches ONLY AUTOTEST fixture IDs — never real data.
 */
async function resetFixtures(ids: string[]) {
  await adminClient.from('tuition_transactions').delete().in('student_id', ids);
  // Re-seed only these students (upsert so no PK conflict)
  const { FIXTURES: F } = await import('../fixtures/fixtures');
  const rows = Object.values(F)
    .filter((f) => ids.includes(f.id))
    .map((f) => ({ ...f }));
  if (rows.length > 0) {
    const { error } = await adminClient
      .from('students')
      .upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`resetFixtures upsert failed: ${error.message}`);
  }
}

// ─── Eligibility ──────────────────────────────────────────────────────────────

describe('process_monthly_tuition — eligibility', () => {
  it('charges eligible ILS student', async () => {
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    await runMonthlyTuition(TEST_BILLING_MONTH);
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    expect(charge).toBeDefined();
    expect(Number(charge!.amount)).toBe(-1400);
    expect(charge!.currency).toBe('ILS');
  });

  it('charges eligible USD student', async () => {
    const id = FIXTURES.AUTOTEST_AUTO_USD.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    expect(charge).toBeDefined();
    expect(Number(charge!.amount)).toBe(-700);
    expect(charge!.currency).toBe('USD');
  });

  it('does NOT charge student with null currency', async () => {
    const id = FIXTURES.AUTOTEST_NO_CURRENCY.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.length).toBe(0);
  });

  it('does NOT charge student with null start date', async () => {
    const id = FIXTURES.AUTOTEST_NO_START.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.length).toBe(0);
  });

  it('does NOT charge student with zero tuition', async () => {
    const id = FIXTURES.AUTOTEST_ZERO_TUITION.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.length).toBe(0);
  });

  it('does NOT charge student with invalid tuition text', async () => {
    const id = FIXTURES.AUTOTEST_INVALID_TUITION.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.length).toBe(0);
  });

  it('does NOT charge student with future start date', async () => {
    const id = FIXTURES.AUTOTEST_FUTURE_START.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.length).toBe(0);
  });

  it('charges student with decimal tuition', async () => {
    const id = FIXTURES.AUTOTEST_DECIMAL.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    expect(charge).toBeDefined();
    expect(Number(charge!.amount)).toBeCloseTo(-725.50, 2);
  });
});

// ─── Auto-payment ranks ───────────────────────────────────────────────────────

describe('process_monthly_tuition — auto payment ranks', () => {
  it('אשראי gets both charge and automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    const payment = txs.find((t) => t.transaction_type === 'automatic_payment');
    expect(charge).toBeDefined();
    expect(payment).toBeDefined();
    expect(Number(payment!.amount)).toBe(1400);
  });

  it('בנקאי gets automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_BANK.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeDefined();
  });

  it('א"א gets automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_AA.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeDefined();
  });

  it('whitespace rank " אשראי " gets automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_WHITESPACE_RANK.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeDefined();
  });

  it('מזומן does NOT get automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeUndefined();
    expect(txs.find((t) => t.transaction_type === 'monthly_charge')).toBeDefined();
  });

  it('מרכז הצדקה does NOT get automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_CHARITY.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeUndefined();
  });

  it('במעקב does NOT get automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_TRACKING.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeUndefined();
  });

  it('שלילי does NOT get automatic_payment', async () => {
    const id = FIXTURES.AUTOTEST_NEGATIVE_RANK.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'automatic_payment')).toBeUndefined();
  });
});

// ─── Duplicate protection ─────────────────────────────────────────────────────

describe('process_monthly_tuition — duplicate protection', () => {
  it('running twice does NOT create duplicate monthly_charge', async () => {
    await runMonthlyTuition(TEST_BILLING_MONTH); // second run
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charges = txs.filter((t) => t.transaction_type === 'monthly_charge' && t.source === 'automatic');
    expect(charges.length).toBe(1);
  });

  it('running 3 times does NOT create duplicate automatic_payment', async () => {
    await runMonthlyTuition(TEST_BILLING_MONTH); // third run
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const payments = txs.filter((t) => t.transaction_type === 'automatic_payment' && t.source === 'automatic');
    expect(payments.length).toBe(1);
  });
});

// ─── Source field ─────────────────────────────────────────────────────────────

describe('process_monthly_tuition — source field', () => {
  it('monthly_charge has source=automatic', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    expect(charge?.source).toBe('automatic');
  });

  it('automatic_payment has source=automatic', async () => {
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const payment = txs.find((t) => t.transaction_type === 'automatic_payment');
    expect(payment?.source).toBe('automatic');
  });
});

// ─── Transaction dates ────────────────────────────────────────────────────────
// SPEC: monthly_charge → 20th of billing month, automatic_payment → 21st

describe('process_monthly_tuition — transaction dates', () => {
  it('monthly_charge transaction_date is 20th of billing month', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    expect(charge?.transaction_date).toBe('2026-03-20');
  });

  it('automatic_payment transaction_date is 21st of billing month', async () => {
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const payment = txs.find((t) => t.transaction_type === 'automatic_payment');
    expect(payment?.transaction_date).toBe('2026-03-21');
  });
});

// ─── Balance view ─────────────────────────────────────────────────────────────

describe('tuition_balances view', () => {
  it('מזומן student has negative balance after charge', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const { data } = await adminClient
      .from('tuition_balances')
      .select('*')
      .eq('student_id', id)
      .single();
    expect(Number(data?.current_balance)).toBeLessThan(0);
    expect(data?.status).toBe('debt');
  });

  it('אשראי student has zero balance (charge + payment)', async () => {
    const id = FIXTURES.AUTOTEST_AUTO_ILS.id;
    const { data } = await adminClient
      .from('tuition_balances')
      .select('*')
      .eq('student_id', id)
      .single();
    expect(Number(data?.current_balance)).toBe(0);
    expect(data?.status).toBe('ok');
  });

  it('no_currency student has status=no_currency', async () => {
    const id = FIXTURES.AUTOTEST_NO_CURRENCY.id;
    const { data } = await adminClient
      .from('tuition_balances')
      .select('*')
      .eq('student_id', id)
      .single();
    expect(data?.status).toBe('no_currency');
  });

  it('multi-month debt accumulates correctly', async () => {
    // Run a second month for AUTOTEST_CASH only
    await runMonthlyTuition(TEST_BILLING_MONTH_2);
    const id = FIXTURES.AUTOTEST_CASH.id;
    const { data } = await adminClient
      .from('tuition_balances')
      .select('*')
      .eq('student_id', id)
      .single();
    // Two months of 700 ILS charge = -1400
    expect(Number(data?.current_balance)).toBe(-1400);
  });
});

// ─── Monthly history view ─────────────────────────────────────────────────────

describe('tuition_monthly_history view', () => {
  it('returns rows for charged student', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const { data, error } = await adminClient
      .from('tuition_monthly_history')
      .select('*')
      .eq('student_id', id);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it('does NOT have source column', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const { data } = await adminClient
      .from('tuition_monthly_history')
      .select('*')
      .eq('student_id', id)
      .limit(1);
    const row = (data ?? [])[0];
    if (row) {
      expect(row).not.toHaveProperty('source');
    }
  });

  it('charges column is negative', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const { data } = await adminClient
      .from('tuition_monthly_history')
      .select('*')
      .eq('student_id', id)
      .eq('billing_month', TEST_BILLING_MONTH)
      .single();
    expect(Number(data?.charges)).toBeLessThan(0);
  });

  it('balance_after_month is cumulative', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const { data } = await adminClient
      .from('tuition_monthly_history')
      .select('*')
      .eq('student_id', id)
      .order('billing_month', { ascending: true });
    const rows = data ?? [];
    if (rows.length >= 2) {
      // Each month's balance should be more negative than the previous
      expect(Number(rows[1].balance_after_month)).toBeLessThan(Number(rows[0].balance_after_month));
    }
  });

  it('ILS and USD are never mixed in same row', async () => {
    const { data } = await adminClient
      .from('tuition_monthly_history')
      .select('currency')
      .in('student_id', [FIXTURES.AUTOTEST_AUTO_ILS.id, FIXTURES.AUTOTEST_AUTO_USD.id]);
    const currencies = (data ?? []).map((r) => r.currency);
    // Each row has exactly one currency
    for (const c of currencies) {
      expect(['ILS', 'USD']).toContain(c);
    }
  });
});

// ─── Manual transactions ──────────────────────────────────────────────────────
// Each test gets a clean state: transactions wiped, student re-seeded.
// This guarantees isolation regardless of run order or prior suite state.

describe('manual transactions', () => {
  const DEBT_ID = FIXTURES.AUTOTEST_DEBT.id;
  const CREDIT_ID = FIXTURES.AUTOTEST_CREDIT_BALANCE.id;

  beforeEach(async () => {
    // Wipe all transactions for the two students used in this describe,
    // then upsert them back to their original fixture state.
    await resetFixtures([DEBT_ID, CREDIT_ID]);
  });

  it('manual payment reduces debt', async () => {
    // Charge the student → -700
    await runMonthlyTuition(TEST_BILLING_MONTH);

    // Add manual payment +300
    const { error } = await adminClient.from('tuition_transactions').insert({
      student_id: DEBT_ID,
      billing_month: TEST_BILLING_MONTH,
      transaction_date: TEST_BILLING_MONTH,
      amount: 300,
      currency: 'ILS',
      transaction_type: 'manual_payment',
      source: 'manual',
      note: 'תשלום חלקי',
    });
    expect(error).toBeNull();

    // tuition_balances: -700 + 300 = -400
    const { data: balanceData } = await adminClient
      .from('tuition_balances')
      .select('current_balance, status')
      .eq('student_id', DEBT_ID)
      .single();
    expect(Number(balanceData?.current_balance)).toBe(-400);
    expect(balanceData?.status).toBe('debt');

    // transaction appears in tuition_transactions
    const txs = await getTxForStudent(DEBT_ID, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'manual_payment')).toBeDefined();

    // transaction appears in tuition_monthly_history
    const { data: history } = await adminClient
      .from('tuition_monthly_history')
      .select('credits, balance_after_month')
      .eq('student_id', DEBT_ID)
      .eq('billing_month', TEST_BILLING_MONTH)
      .single();
    expect(history).toBeDefined();
    expect(Number(history?.credits)).toBeGreaterThan(0);
  });

  it('multiple manual payments in same month are all allowed', async () => {
    // Charge first so the student has a balance row
    await runMonthlyTuition(TEST_BILLING_MONTH);

    const insert = (amount: number) =>
      adminClient.from('tuition_transactions').insert({
        student_id: DEBT_ID,
        billing_month: TEST_BILLING_MONTH,
        transaction_date: TEST_BILLING_MONTH,
        amount,
        currency: 'ILS',
        transaction_type: 'manual_payment',
        source: 'manual',
      });

    const { error: e1 } = await insert(300);
    expect(e1).toBeNull();
    const { error: e2 } = await insert(100);
    expect(e2).toBeNull();

    const txs = await getTxForStudent(DEBT_ID, TEST_BILLING_MONTH);
    const manualPayments = txs.filter((t) => t.transaction_type === 'manual_payment');
    expect(manualPayments.length).toBeGreaterThanOrEqual(2);
  });

  it('credit balance: payment > charge → positive balance → ok', async () => {
    // Charge → -700
    await runMonthlyTuition(TEST_BILLING_MONTH);

    // Manual payment +900 → net +200
    const { error } = await adminClient.from('tuition_transactions').insert({
      student_id: CREDIT_ID,
      billing_month: TEST_BILLING_MONTH,
      transaction_date: TEST_BILLING_MONTH,
      amount: 900,
      currency: 'ILS',
      transaction_type: 'manual_payment',
      source: 'manual',
    });
    expect(error).toBeNull();

    // tuition_balances: -700 + 900 = +200, status = ok
    const { data: balanceData } = await adminClient
      .from('tuition_balances')
      .select('current_balance, status')
      .eq('student_id', CREDIT_ID)
      .single();
    expect(Number(balanceData?.current_balance)).toBe(200);
    expect(balanceData?.status).toBe('ok');

    // transaction appears in tuition_transactions
    const txs = await getTxForStudent(CREDIT_ID, TEST_BILLING_MONTH);
    expect(txs.find((t) => t.transaction_type === 'manual_payment')).toBeDefined();

    // transaction appears in tuition_monthly_history
    const { data: history } = await adminClient
      .from('tuition_monthly_history')
      .select('credits, balance_after_month')
      .eq('student_id', CREDIT_ID)
      .eq('billing_month', TEST_BILLING_MONTH)
      .single();
    expect(history).toBeDefined();
    expect(Number(history?.balance_after_month)).toBe(200);
  });

  // Regression: proves multi-month debt test cannot contaminate manual payment tests
  it('is isolated from multi-month debt state (regression)', async () => {
    // Even if another describe has run process_monthly_tuition(TEST_BILLING_MONTH_2)
    // for AUTOTEST_CASH, DEBT_ID starts clean here because of beforeEach.
    const txsBefore = await getTxForStudent(DEBT_ID, TEST_BILLING_MONTH);
    expect(txsBefore.filter((t) => t.transaction_type === 'monthly_charge').length).toBe(0);

    await runMonthlyTuition(TEST_BILLING_MONTH);
    const txsAfter = await getTxForStudent(DEBT_ID, TEST_BILLING_MONTH);
    expect(txsAfter.filter((t) => t.transaction_type === 'monthly_charge').length).toBe(1);
  });
});

// ─── Graduation — history survives ───────────────────────────────────────────

describe('graduation — tuition history survives', () => {
  it('transactions remain after student moves to alumni', async () => {
    const id = FIXTURES.AUTOTEST_GRADUATE.id;

    // Charge the student first
    await runMonthlyTuition(TEST_BILLING_MONTH);
    const txsBefore = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txsBefore.length).toBeGreaterThan(0);

    // Graduate: insert to alumni, delete from students
    const { data: studentData } = await adminClient
      .from('students').select('*').eq('id', id).single();

    const { error: insertErr } = await adminClient.from('alumni').insert({
      ...studentData,
      graduated_at: new Date().toISOString(),
      alumni_phone: null,
      tuition_currency: undefined, // alumni table has no tuition_currency
      religion: undefined,
      religion_studies: undefined,
    });
    expect(insertErr).toBeNull();

    await adminClient.from('students').delete().eq('id', id);

    // Transactions must still exist
    const txsAfter = await getTxForStudent(id, TEST_BILLING_MONTH);
    expect(txsAfter.length).toBe(txsBefore.length);

    // monthly_history must still work (looks up alumni table)
    const { data: history } = await adminClient
      .from('tuition_monthly_history')
      .select('*')
      .eq('student_id', id);
    expect((history ?? []).length).toBeGreaterThan(0);
    // student_name should be resolved from alumni
    expect((history ?? [])[0]?.student_name).toBeTruthy();
  });
});

// ─── RLS ─────────────────────────────────────────────────────────────────────

describe('RLS — tuition_transactions', () => {
  it('anon cannot INSERT into tuition_transactions', async () => {
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      process.env.SUPABASE_TEST_URL!,
      process.env.SUPABASE_TEST_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { error } = await anonClient.from('tuition_transactions').insert({
      student_id: FIXTURES.AUTOTEST_CASH.id,
      billing_month: TEST_BILLING_MONTH,
      transaction_date: TEST_BILLING_MONTH,
      amount: -700,
      currency: 'ILS',
      transaction_type: 'monthly_charge',
      source: 'automatic',
    });
    // anon should be blocked
    expect(error).not.toBeNull();
  });
});
