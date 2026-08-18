/**
 * INTEGRATION TESTS ג€” Cancellation, Audit, Profiles, RPC permissions
 * Requires .env.test.local with SUPABASE_TEST_USER_EMAIL + PASSWORD.
 * Runs against real DB ג€” fixtures created/cleaned automatically.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { adminClient, anonClient, getAuthClient } from './integrationSetup';
import { FIXTURES, TEST_BILLING_MONTH } from '../fixtures/fixtures';
import { assertDestructiveTestsAllowed } from '../guards/destructiveGuard';

// ג”€ג”€ constants ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
// Using dedicated UUIDs that don't overlap with fixtures.ts
// This prevents state contamination with tuition.integration.test.ts

const CANCEL_CASH_ID  = '00000000-0000-4901-a000-000000000901'; // ILS 700 ׳׳–׳•׳׳
const CANCEL_AUTO_ID  = '00000000-0000-4902-a000-000000000902'; // ILS 1400 ׳׳©׳¨׳׳™
const CANCEL_DEBT_ID  = '00000000-0000-4903-a000-000000000903'; // ILS 700 ׳׳–׳•׳׳
const ALL_CANCEL_IDS  = [CANCEL_CASH_ID, CANCEL_AUTO_ID, CANCEL_DEBT_ID];
const MONTH           = TEST_BILLING_MONTH; // '2026-03-01'

const CANCEL_FIXTURES: Record<string, Record<string, unknown>> = {
  [CANCEL_CASH_ID]: {
    id: CANCEL_CASH_ID, first_name: 'CancelCash', last_name: 'AUTOTEST',
    full_name: 'AUTOTEST CancelCash', passport_or_id: 'CANCELTEST901',
    tuition: '700', tuition_currency: 'ILS', tuition_rank: '׳׳–׳•׳׳',
    tuition_start_date: '2026-01-01',
  },
  [CANCEL_AUTO_ID]: {
    id: CANCEL_AUTO_ID, first_name: 'CancelAuto', last_name: 'AUTOTEST',
    full_name: 'AUTOTEST CancelAuto', passport_or_id: 'CANCELTEST902',
    tuition: '1400', tuition_currency: 'ILS', tuition_rank: '׳׳©׳¨׳׳™',
    tuition_start_date: '2026-01-01',
  },
  [CANCEL_DEBT_ID]: {
    id: CANCEL_DEBT_ID, first_name: 'CancelDebt', last_name: 'AUTOTEST',
    full_name: 'AUTOTEST CancelDebt', passport_or_id: 'CANCELTEST903',
    tuition: '700', tuition_currency: 'ILS', tuition_rank: '׳׳–׳•׳׳',
    tuition_start_date: '2026-01-01',
  },
};

// ג”€ג”€ helpers ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

async function seedCancelFixtures() {
  await adminClient.from('tuition_transactions').delete().in('student_id', ALL_CANCEL_IDS);
  await adminClient.from('students').upsert(Object.values(CANCEL_FIXTURES), { onConflict: 'id' });
}

async function chargeStudent(_studentId: string, billingMonth = MONTH) {  const { data, error } = await adminClient.rpc('process_monthly_tuition', {
    p_billing_month: billingMonth,
  });
  if (error) throw new Error(error.message);
  return data;
}

async function getTxForStudent(studentId: string, billingMonth = MONTH) {
  const { data, error } = await adminClient
    .from('tuition_transactions')
    .select('*')
    .eq('student_id', studentId)
    .eq('billing_month', billingMonth);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getBalance(studentId: string) {
  const { data } = await adminClient
    .from('tuition_balances')
    .select('current_balance, status')
    .eq('student_id', studentId)
    .single();
  return data;
}

async function getHistory(studentId: string) {
  const { data } = await adminClient
    .from('tuition_monthly_history')
    .select('*')
    .eq('student_id', studentId);
  return data ?? [];
}

// ג”€ג”€ global setup ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

beforeAll(async () => {
  assertDestructiveTestsAllowed();
  await seedCancelFixtures();
  // Run monthly tuition to create automatic transactions for all cancel fixtures
  await chargeStudent(CANCEL_CASH_ID);
  await chargeStudent(CANCEL_DEBT_ID);
  await chargeStudent(CANCEL_AUTO_ID);
});

afterAll(async () => {
  await adminClient.from('tuition_transactions').delete().in('student_id', ALL_CANCEL_IDS);
  await adminClient.from('alumni').delete().in('id', ALL_CANCEL_IDS);
  await adminClient.from('students').delete().in('id', ALL_CANCEL_IDS);
});

// ג”€ג”€ SECTION 1: direct write blocking ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('tuition_transactions ג€” direct writes blocked for authenticated', () => {
  let authClient: Awaited<ReturnType<typeof getAuthClient>>;

  beforeAll(async () => { authClient = await getAuthClient(); });

  it('authenticated direct INSERT is rejected', async () => {
    const { error } = await authClient.from('tuition_transactions').insert({
      student_id: CANCEL_CASH_ID,
      billing_month: MONTH,
      transaction_date: MONTH,
      amount: -100,
      currency: 'ILS',
      transaction_type: 'manual_charge',
      source: 'manual',
    });
    expect(error).not.toBeNull();
  });

  it('authenticated direct UPDATE is rejected', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    if (txs.length === 0) return; // guard
    const { error } = await authClient
      .from('tuition_transactions')
      .update({ note: 'hacked' })
      .eq('id', txs[0].id);
    expect(error).not.toBeNull();
  });

  it('authenticated direct DELETE is rejected', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    if (txs.length === 0) return;
    const { error } = await authClient
      .from('tuition_transactions')
      .delete()
      .eq('id', txs[0].id);
    expect(error).not.toBeNull();
  });
});

// ג”€ג”€ SECTION 2: add_manual_transaction RPC ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('add_manual_transaction RPC', () => {
  let authClient: Awaited<ReturnType<typeof getAuthClient>>;

  beforeAll(async () => { authClient = await getAuthClient(); });

  it('anon cannot call add_manual_transaction', async () => {
    const { error } = await anonClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: 300,
      p_currency: 'ILS', p_transaction_type: 'manual_payment',
    });
    expect(error).not.toBeNull();
  });

  it('authenticated can call add_manual_transaction', async () => {
    const { error } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: 300,
      p_currency: 'ILS', p_transaction_type: 'manual_payment',
      p_note: 'test payment',
    });
    expect(error).toBeNull();
  });

  it('created_by is set to auth.uid() ג€” not NULL, not forgeable', async () => {
    const { data: { user } } = await authClient.auth.getUser();
    const txs = await getTxForStudent(CANCEL_DEBT_ID);
    const manual = txs.find((t: Record<string, unknown>) => t.transaction_type === 'manual_payment');
    expect(manual).toBeDefined();
    expect(manual!.created_by).toBe(user!.id);
  });

  it('manual_payment negative amount rejected', async () => {
    const { error } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: -300,
      p_currency: 'ILS', p_transaction_type: 'manual_payment',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('positive');
  });

  it('manual_charge positive amount rejected', async () => {
    const { error } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: 300,
      p_currency: 'ILS', p_transaction_type: 'manual_charge',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('negative');
  });

  it('zero amount rejected', async () => {
    const { error } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: 0,
      p_currency: 'ILS', p_transaction_type: 'adjustment',
    });
    expect(error).not.toBeNull();
  });

  it('adjustment positive allowed', async () => {
    const { error } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: 50,
      p_currency: 'ILS', p_transaction_type: 'adjustment',
    });
    expect(error).toBeNull();
  });

  it('adjustment negative allowed', async () => {
    const { error } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_DEBT_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: -50,
      p_currency: 'ILS', p_transaction_type: 'adjustment',
    });
    expect(error).toBeNull();
  });
});

// ג”€ג”€ SECTION 3: cancel_transaction RPC ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('cancel_transaction RPC', () => {
  let authClient: Awaited<ReturnType<typeof getAuthClient>>;

  beforeEach(async () => {
    authClient = await getAuthClient();
    // Clean and re-seed CANCEL_CASH_ID for isolation
    await adminClient.from('tuition_transactions').delete().in('student_id', [CANCEL_CASH_ID]);
    await adminClient.from('students').upsert(
      [FIXTURES.AUTOTEST_CASH as unknown as Record<string, unknown>],
      { onConflict: 'id' }
    );
    await chargeStudent(CANCEL_CASH_ID);
  });

  it('anon cannot call cancel_transaction', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    const { error } = await anonClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: 'test',
    });
    expect(error).not.toBeNull();
  });

  it('authenticated can cancel a transaction', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    const { error } = await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳“׳™׳§׳× ׳‘׳™׳˜׳•׳',
    });
    expect(error).toBeNull();
  });

  it('balance excludes cancelled transaction', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳™׳˜׳•׳ ׳׳‘׳“׳™׳§׳× ׳™׳×׳¨׳”',
    });
    const bal = await getBalance(CANCEL_CASH_ID);
    expect(Number(bal!.current_balance)).toBe(0);
  });

  it('cancelled transaction absent from tuition_monthly_history', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳™׳˜׳•׳ ׳׳‘׳“׳™׳§׳× ׳”׳™׳¡׳˜׳•׳¨׳™׳”',
    });
    const history = await getHistory(CANCEL_CASH_ID);
    // All transactions cancelled ג†’ month should not appear
    expect(history.length).toBe(0);
  });

  it('cancelled transaction still visible in tuition_transactions (audit)', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳™׳˜׳•׳ ׳׳‘׳“׳™׳§׳× audit',
    });
    // Must still exist in raw table
    const { data } = await adminClient
      .from('tuition_transactions')
      .select('*')
      .eq('id', tx!.id)
      .single();
    expect(data).not.toBeNull();
    expect(data!.cancelled_at).not.toBeNull();
    expect(data!.cancellation_reason).toBe('׳‘׳™׳˜׳•׳ ׳׳‘׳“׳™׳§׳× audit');
  });

  it('cancelled_by = auth.uid() ג€” not forgeable', async () => {
    const { data: { user } } = await authClient.auth.getUser();
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳“׳™׳§׳× cancelled_by',
    });
    const { data } = await adminClient
      .from('tuition_transactions')
      .select('cancelled_by')
      .eq('id', tx!.id)
      .single();
    expect(data!.cancelled_by).toBe(user!.id);
  });

  it('empty cancellation_reason rejected', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    const { error } = await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('required');
  });

  it('whitespace-only cancellation_reason rejected', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    const { error } = await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '   ',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('required');
  });

  it('double cancel blocked ג€” atomic', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳™׳˜׳•׳ ׳¨׳׳©׳•׳',
    });
    const { error } = await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳ ׳™׳¡׳™׳•׳ ׳‘׳™׳˜׳•׳ ׳›׳₪׳•׳',
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('already cancelled');
  });

  it('process_monthly_tuition rerun does NOT recreate cancelled automatic transaction', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const tx = txs.find((t: Record<string, unknown>) =>
      t.transaction_type === 'monthly_charge' && t.source === 'automatic'
    );
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: tx!.id, p_reason: '׳‘׳“׳™׳§׳× idempotency',
    });
    // Rerun for same month
    await adminClient.rpc('process_monthly_tuition', { p_billing_month: MONTH });
    // Still only one monthly_charge row (cancelled)
    const allTxs = await getTxForStudent(CANCEL_CASH_ID);
    const charges = allTxs.filter((t: Record<string, unknown>) =>
      t.transaction_type === 'monthly_charge' && t.source === 'automatic'
    );
    expect(charges.length).toBe(1);
    expect(charges[0].cancelled_at).not.toBeNull();
  });

  it('cancel automatic_payment ג€” balance recomputed correctly', async () => {
    const txs = await getTxForStudent(CANCEL_AUTO_ID);
    const payment = txs.find((t: Record<string, unknown>) => t.transaction_type === 'automatic_payment');
    expect(payment).toBeDefined();
    // Before cancel: balance = 0 (charge + payment)
    const balBefore = await getBalance(CANCEL_AUTO_ID);
    expect(Number(balBefore!.current_balance)).toBe(0);

    await authClient.rpc('cancel_transaction', {
      p_transaction_id: payment!.id, p_reason: '׳‘׳™׳˜׳•׳ ׳×׳©׳׳•׳ ׳׳•׳˜׳•׳׳˜׳™',
    });
    // After cancel: only charge remains ג†’ -1400
    const balAfter = await getBalance(CANCEL_AUTO_ID);
    expect(Number(balAfter!.current_balance)).toBe(-1400);
  });
});

// ג”€ג”€ SECTION 4: update_manual_transaction RPC ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('update_manual_transaction RPC', () => {
  let authClient: Awaited<ReturnType<typeof getAuthClient>>;
  let manualTxId: string;

  beforeAll(async () => {
    authClient = await getAuthClient();
    // Insert a manual transaction to edit
    const { data } = await authClient.rpc('add_manual_transaction', {
      p_student_id: CANCEL_CASH_ID, p_billing_month: MONTH,
      p_transaction_date: MONTH, p_amount: 200,
      p_currency: 'ILS', p_transaction_type: 'manual_payment',
      p_note: 'initial',
    });
    manualTxId = (data as Record<string, unknown>).id as string;
  });

  it('update manual_payment works', async () => {
    const { error } = await authClient.rpc('update_manual_transaction', {
      p_transaction_id: manualTxId, p_amount: 300,
    });
    expect(error).toBeNull();
    const { data } = await adminClient
      .from('tuition_transactions')
      .select('amount')
      .eq('id', manualTxId)
      .single();
    expect(Number(data!.amount)).toBe(300);
  });

  it('cannot edit monthly_charge', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    const charge = txs.find((t: Record<string, unknown>) => t.transaction_type === 'monthly_charge');
    if (!charge) return;
    const { error } = await authClient.rpc('update_manual_transaction', {
      p_transaction_id: charge.id, p_amount: -500,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/automatic|monthly_charge/i);
  });

  it('change paymentג†’charge without amount rejected (effective pair)', async () => {
    // manualTxId is manual_payment with amount=300 (positive)
    // Trying to change type to manual_charge without changing amount would make amount invalid
    const { error } = await authClient.rpc('update_manual_transaction', {
      p_transaction_id: manualTxId,
      p_transaction_type: 'manual_charge', // amount stays +300 ג€” invalid for charge
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('negative');
  });

  it('change type + compatible amount together succeeds', async () => {
    const { error } = await authClient.rpc('update_manual_transaction', {
      p_transaction_id: manualTxId,
      p_transaction_type: 'manual_charge',
      p_amount: -300, // negative ג€” valid for manual_charge
    });
    expect(error).toBeNull();
  });

  it('cannot edit cancelled transaction', async () => {
    // Cancel it first
    await authClient.rpc('cancel_transaction', {
      p_transaction_id: manualTxId, p_reason: '׳‘׳™׳˜׳•׳ ׳׳‘׳“׳™׳§׳× ׳¢׳¨׳™׳›׳”',
    });
    const { error } = await authClient.rpc('update_manual_transaction', {
      p_transaction_id: manualTxId, p_amount: -500,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toContain('cancelled');
  });
});

// ג”€ג”€ SECTION 5: system RPCs ג€” authenticated blocked ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('system RPCs ג€” authenticated cannot call', () => {
  let authClient: Awaited<ReturnType<typeof getAuthClient>>;

  beforeAll(async () => { authClient = await getAuthClient(); });

  it('authenticated cannot call process_monthly_tuition', async () => {
    const { error } = await authClient.rpc('process_monthly_tuition', {
      p_billing_month: '2099-01-01',
    });
    expect(error).not.toBeNull();
  });

  it('authenticated cannot call run_tuition_backfill', async () => {
    const { error } = await authClient.rpc('run_tuition_backfill');
    expect(error).not.toBeNull();
  });

  it('service_role can call process_monthly_tuition', async () => {
    const { error } = await adminClient.rpc('process_monthly_tuition', {
      p_billing_month: '2099-01-01',
    });
    expect(error).toBeNull();
  });
});

// ג”€ג”€ SECTION 6: profiles ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('profiles ג€” column visibility', () => {
  let authClient: Awaited<ReturnType<typeof getAuthClient>>;

  beforeAll(async () => { authClient = await getAuthClient(); });

  it('SELECT id, display_name succeeds for authenticated', async () => {
    const { data, error } = await authClient
      .from('profiles')
      .select('id, display_name')
      .limit(1);
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it('SELECT role fails for authenticated', async () => {
    const { error } = await authClient
      .from('profiles')
      .select('id, role')
      .limit(1);
    expect(error).not.toBeNull();
  });

  it('SELECT * fails for authenticated', async () => {
    const { error } = await authClient
      .from('profiles')
      .select('*')
      .limit(1);
    expect(error).not.toBeNull();
  });

  it('direct INSERT into profiles rejected', async () => {
    const { data: { user } } = await authClient.auth.getUser();
    const { error } = await authClient
      .from('profiles')
      .insert({ id: user!.id, display_name: 'hacked', role: 'admin' });
    expect(error).not.toBeNull();
  });

  it('direct UPDATE on profiles rejected', async () => {
    const { data: { user } } = await authClient.auth.getUser();
    const { error } = await authClient
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', user!.id);
    expect(error).not.toBeNull();
  });

  it('update_display_name RPC works', async () => {
    const { error } = await authClient.rpc('update_display_name', {
      p_display_name: '׳©׳ ׳‘׳“׳™׳§׳”',
    });
    expect(error).toBeNull();
    // Verify via service role (can read all columns)
    const { data: { user } } = await authClient.auth.getUser();
    const { data } = await adminClient
      .from('profiles')
      .select('display_name')
      .eq('id', user!.id)
      .single();
    expect(data!.display_name).toBe('׳©׳ ׳‘׳“׳™׳§׳”');
  });
});

// ג”€ג”€ SECTION 7: views ג€” cancelled-only month absent ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

describe('tuition_monthly_history ג€” cancelled-only month', () => {
  beforeEach(async () => {
    await adminClient.from('tuition_transactions').delete().in('student_id', [CANCEL_CASH_ID]);
    await adminClient.from('students').upsert(
      [FIXTURES.AUTOTEST_CASH as unknown as Record<string, unknown>],
      { onConflict: 'id' }
    );
    await chargeStudent(CANCEL_CASH_ID);
  });

  it('month with all-cancelled transactions does NOT appear in history', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    // Cancel all transactions for this month
    for (const tx of txs) {
      await adminClient
        .from('tuition_transactions')
        .update({ cancelled_at: new Date().toISOString(), cancellation_reason: 'test' })
        .eq('id', (tx as Record<string, unknown>).id);
    }
    const history = await getHistory(CANCEL_CASH_ID);
    expect(history.length).toBe(0);
  });

  it('month with one active transaction still appears in history', async () => {
    const txs = await getTxForStudent(CANCEL_CASH_ID);
    // Cancel all but one
    for (let i = 1; i < txs.length; i++) {
      await adminClient
        .from('tuition_transactions')
        .update({ cancelled_at: new Date().toISOString(), cancellation_reason: 'test' })
        .eq('id', (txs[i] as Record<string, unknown>).id);
    }
    const history = await getHistory(CANCEL_CASH_ID);
    expect(history.length).toBeGreaterThan(0);
  });
});
