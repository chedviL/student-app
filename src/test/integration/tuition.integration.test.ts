/**
 * INTEGRATION TESTS — process_monthly_tuition
 * Requires .env.test.local with valid Supabase credentials.
 * Runs against real DB — fixtures are created/cleaned automatically.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, seedFixtures, cleanupFixtures } from './integrationSetup';
import { FIXTURES, TEST_BILLING_MONTH, TEST_BILLING_MONTH_2 } from '../fixtures/fixtures';
import { assertDestructiveTestsAllowed } from '../guards/destructiveGuard';

beforeAll(async () => {
  assertDestructiveTestsAllowed();
  await seedFixtures();
});

afterAll(async () => {
  await cleanupFixtures();
});

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

// ─── REGRESSION: transaction_date ────────────────────────────────────────────
// SPEC says: monthly_charge → 20th, automatic_payment → 21st
// KNOWN BUG: current implementation sets transaction_date = p_billing_month (1st)
// This test documents the current behavior and will FAIL when the bug is fixed.

describe('process_monthly_tuition — transaction_date (KNOWN BUG)', () => {
  it('BUG: monthly_charge transaction_date is currently 1st of month (should be 20th)', async () => {
    const id = FIXTURES.AUTOTEST_CASH.id;
    const txs = await getTxForStudent(id, TEST_BILLING_MONTH);
    const charge = txs.find((t) => t.transaction_type === 'monthly_charge');
    // Current behavior: date = billing_month (1st)
    // Expected per SPEC: date = 20th of billing month
    // This test documents the bug — do NOT change business logic to make it green
    expect(charge?.transaction_date).toBe(TEST_BILLING_MONTH); // BUG: should be '2026-03-20'
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
    // Run a second month for AUTOTEST_CASH
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

describe('manual transactions', () => {
  const DEBT_ID = FIXTURES.AUTOTEST_DEBT.id;

  it('manual payment reduces debt', async () => {
    // First charge the student
    await runMonthlyTuition(TEST_BILLING_MONTH);

    // Add manual payment
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

    const { data } = await adminClient
      .from('tuition_balances')
      .select('current_balance')
      .eq('student_id', DEBT_ID)
      .single();
    expect(Number(data?.current_balance)).toBe(-400); // -700 + 300
  });

  it('multiple manual payments in same month are all allowed', async () => {
    const { error } = await adminClient.from('tuition_transactions').insert({
      student_id: DEBT_ID,
      billing_month: TEST_BILLING_MONTH,
      transaction_date: TEST_BILLING_MONTH,
      amount: 100,
      currency: 'ILS',
      transaction_type: 'manual_payment',
      source: 'manual',
    });
    expect(error).toBeNull();

    const txs = await getTxForStudent(DEBT_ID, TEST_BILLING_MONTH);
    const manualPayments = txs.filter((t) => t.transaction_type === 'manual_payment');
    expect(manualPayments.length).toBeGreaterThanOrEqual(2);
  });

  it('credit balance: payment > charge → positive balance → ok', async () => {
    const id = FIXTURES.AUTOTEST_CREDIT_BALANCE.id;
    await runMonthlyTuition(TEST_BILLING_MONTH);

    await adminClient.from('tuition_transactions').insert({
      student_id: id,
      billing_month: TEST_BILLING_MONTH,
      transaction_date: TEST_BILLING_MONTH,
      amount: 900, // more than 700 charge
      currency: 'ILS',
      transaction_type: 'manual_payment',
      source: 'manual',
    });

    const { data } = await adminClient
      .from('tuition_balances')
      .select('*')
      .eq('student_id', id)
      .single();
    expect(Number(data?.current_balance)).toBe(200);
    expect(data?.status).toBe('ok');
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
