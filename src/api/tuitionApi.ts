import { supabase } from '../lib/supabaseClient';
import type {
  TuitionTransaction,
  TuitionBalance,
  TuitionMonthSummary,
  NewManualTransaction,
  AllBalancesSummary,
  MonthAggregate,
} from '../types/tuition';

// ── mappers ──────────────────────────────────────────────────────────────────

function mapTransaction(row: Record<string, unknown>): TuitionTransaction {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    billingMonth: String(row.billing_month),
    transactionDate: String(row.transaction_date),
    amount: Number(row.amount),
    currency: row.currency as TuitionTransaction['currency'],
    transactionType: row.transaction_type as TuitionTransaction['transactionType'],
    source: row.source as TuitionTransaction['source'],
    note: row.note ? String(row.note) : null,
    createdAt: String(row.created_at),
  };
}

function mapBalance(row: Record<string, unknown>): TuitionBalance {
  return {
    studentId: String(row.student_id),
    currency: (row.currency as TuitionBalance['currency']) ?? null,
    currentBalance: Number(row.current_balance),
    status: row.status as TuitionBalance['status'],
  };
}

function mapMonthSummary(row: Record<string, unknown>): TuitionMonthSummary {
  return {
    studentId: String(row.student_id),
    billingMonth: String(row.billing_month),
    charges: row.charges !== null ? Number(row.charges) : null,
    credits: row.credits !== null ? Number(row.credits) : null,
    monthlyTotal: Number(row.monthly_total),
    balanceAfterMonth: Number(row.balance_after_month),
    currency: row.currency as TuitionMonthSummary['currency'],
  };
}

// ── public API ───────────────────────────────────────────────────────────────

/** Current balance for a single student */
export async function getStudentBalance(studentId: string): Promise<TuitionBalance | null> {
  const { data, error } = await supabase
    .from('tuition_balances')
    .select('*')
    .eq('student_id', studentId)
    .single();

  if (error || !data) return null;
  return mapBalance(data as Record<string, unknown>);
}

/** Monthly history for a student, ordered newest → oldest */
export async function getStudentMonthlyHistory(studentId: string): Promise<TuitionMonthSummary[]> {
  const { data, error } = await supabase
    .from('tuition_monthly_history')
    .select('*')
    .eq('student_id', studentId)
    .order('billing_month', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapMonthSummary(r as Record<string, unknown>));
}

/** All transactions for a student in a specific billing month */
export async function getMonthTransactions(
  studentId: string,
  billingMonth: string
): Promise<TuitionTransaction[]> {
  const { data, error } = await supabase
    .from('tuition_transactions')
    .select('*')
    .eq('student_id', studentId)
    .eq('billing_month', billingMonth)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTransaction(r as Record<string, unknown>));
}

/** Add a manual transaction (payment, charge, or adjustment) */
export async function addManualTransaction(tx: NewManualTransaction): Promise<TuitionTransaction> {
  const { data, error } = await supabase
    .from('tuition_transactions')
    .insert({
      student_id: tx.studentId,
      billing_month: tx.billingMonth,
      transaction_date: tx.transactionDate,
      amount: tx.amount,
      currency: tx.currency,
      transaction_type: tx.transactionType,
      source: 'manual',
      note: tx.note ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapTransaction(data as Record<string, unknown>);
}

/** Update an existing manual transaction */
export async function updateManualTransaction(
  id: string,
  fields: Partial<Pick<NewManualTransaction, 'amount' | 'transactionDate' | 'billingMonth' | 'transactionType' | 'note'>>
): Promise<TuitionTransaction> {
  const patch: Record<string, unknown> = {};
  if (fields.amount !== undefined)          patch.amount = fields.amount;
  if (fields.transactionDate !== undefined) patch.transaction_date = fields.transactionDate;
  if (fields.billingMonth !== undefined)    patch.billing_month = fields.billingMonth;
  if (fields.transactionType !== undefined) patch.transaction_type = fields.transactionType;
  if (fields.note !== undefined)            patch.note = fields.note ?? null;

  const { data, error } = await supabase
    .from('tuition_transactions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapTransaction(data as Record<string, unknown>);
}

/** Delete a transaction by id */
export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from('tuition_transactions')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** All balances — used by PaymentsPage overview */
export async function getAllBalances(): Promise<TuitionBalance[]> {
  const { data, error } = await supabase
    .from('tuition_balances')
    .select('*');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapBalance(r as Record<string, unknown>));
}

/** Summarise all balances into counts + debt totals */
export function summariseBalances(balances: TuitionBalance[]): AllBalancesSummary {
  let debtors = 0, ok = 0, noCurrency = 0;
  let debtILS = 0, debtUSD = 0;
  for (const b of balances) {
    if (b.status === 'no_currency') { noCurrency++; continue; }
    if (b.currentBalance < 0) {
      debtors++;
      if (b.currency === 'ILS') debtILS += b.currentBalance;
      else if (b.currency === 'USD') debtUSD += b.currentBalance;
    } else {
      ok++;
    }
  }
  return { debtors, ok, noCurrency, debtILS, debtUSD };
}

// ── shared helper: resolve names for a list of student_ids ──────────────────
// Fetches from students first, then alumni for any unresolved ids.
// Returns a Map<id, { name, isAlumni }> — zero N+1 queries.
async function resolveNames(
  ids: string[]
): Promise<Map<string, { name: string; isAlumni: boolean }>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const result = new Map<string, { name: string; isAlumni: boolean }>();

  const [studentsRes, alumniRes] = await Promise.all([
    supabase.from('students').select('id, first_name, last_name').in('id', unique),
    supabase.from('alumni').select('id, first_name, last_name').in('id', unique),
  ]);

  for (const r of (studentsRes.data ?? [])) {
    const row = r as { id: string; first_name: string; last_name: string };
    result.set(row.id, { name: `${row.last_name} ${row.first_name}`, isAlumni: false });
  }
  // alumni fills in any ids not found in students
  for (const r of (alumniRes.data ?? [])) {
    const row = r as { id: string; first_name: string; last_name: string };
    if (!result.has(row.id)) {
      result.set(row.id, { name: `${row.last_name} ${row.first_name}`, isAlumni: true });
    }
  }

  return result;
}

export type TxWithPerson = TuitionTransaction & { studentName?: string; isAlumni?: boolean };

/** Recent transactions across all students + alumni */
export async function getRecentTransactions(limit = 20): Promise<TxWithPerson[]> {
  const { data, error } = await supabase
    .from('tuition_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => mapTransaction(r as Record<string, unknown>));
  const names = await resolveNames(rows.map((r) => r.studentId));
  return rows.map((tx) => ({ ...tx, ...names.get(tx.studentId) && { studentName: names.get(tx.studentId)!.name, isAlumni: names.get(tx.studentId)!.isAlumni } }));
}

/** All transactions with student/alumni name, optional filters */
export async function getAllTransactions(opts?: {
  studentId?: string;
  billingMonth?: string;
  currency?: string;
  transactionType?: string;
  source?: string;
}): Promise<TxWithPerson[]> {
  let q = supabase
    .from('tuition_transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (opts?.studentId)       q = q.eq('student_id', opts.studentId);
  if (opts?.billingMonth)    q = q.eq('billing_month', opts.billingMonth);
  if (opts?.currency)        q = q.eq('currency', opts.currency);
  if (opts?.transactionType) q = q.eq('transaction_type', opts.transactionType as string);
  if (opts?.source)          q = q.eq('source', opts.source);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => mapTransaction(r as Record<string, unknown>));
  const names = await resolveNames(rows.map((r) => r.studentId));
  return rows.map((tx) => ({ ...tx, ...names.get(tx.studentId) && { studentName: names.get(tx.studentId)!.name, isAlumni: names.get(tx.studentId)!.isAlumni } }));
}

/** Month aggregates from tuition_monthly_history grouped by billing_month.
 *  Amounts come from tuition_monthly_history (no source column there).
 *  automatic/manual counts come from tuition_transactions. */
export async function getMonthAggregates(): Promise<MonthAggregate[]> {
  // Two parallel fetches — no N+1, no source from the view
  const [histRes, txRes] = await Promise.all([
    supabase
      .from('tuition_monthly_history')
      .select('billing_month, charges, credits, currency')
      .order('billing_month', { ascending: false }),
    supabase
      .from('tuition_transactions')
      .select('billing_month, source'),
  ]);

  if (histRes.error) throw new Error(histRes.error.message);
  if (txRes.error)   throw new Error(txRes.error.message);

  // Build source counts per billing_month from tuition_transactions
  const sourceCounts = new Map<string, { automatic: number; manual: number }>();
  for (const r of (txRes.data ?? [])) {
    const row = r as { billing_month: string; source: string };
    const month = String(row.billing_month);
    if (!sourceCounts.has(month)) sourceCounts.set(month, { automatic: 0, manual: 0 });
    const sc = sourceCounts.get(month)!;
    if (row.source === 'automatic') sc.automatic++; else sc.manual++;
  }

  // Aggregate history rows by billing_month
  const map = new Map<string, MonthAggregate>();
  for (const r of (histRes.data ?? [])) {
    const row = r as Record<string, unknown>;
    const month = String(row.billing_month);
    const cur = String(row.currency) as 'ILS' | 'USD';
    const charges = row.charges !== null ? Number(row.charges) : 0;
    const credits = row.credits !== null ? Number(row.credits) : 0;
    if (!map.has(month)) map.set(month, { billingMonth: month, countStudents: 0, chargesILS: 0, chargesUSD: 0, creditsILS: 0, creditsUSD: 0, countAutomatic: 0, countManual: 0 });
    const agg = map.get(month)!;
    agg.countStudents++;
    if (cur === 'ILS') { agg.chargesILS += Math.abs(charges); agg.creditsILS += credits; }
    else               { agg.chargesUSD += Math.abs(charges); agg.creditsUSD += credits; }
  }

  // Merge source counts into aggregates
  for (const [month, agg] of map) {
    const sc = sourceCounts.get(month);
    if (sc) { agg.countAutomatic = sc.automatic; agg.countManual = sc.manual; }
  }

  return Array.from(map.values());
}

/** Trigger monthly processing for a given month (defaults to current month).
 *  Calls the Postgres function directly via rpc. */
export async function runMonthlyProcessing(billingMonth?: string): Promise<void> {
  const month = billingMonth ?? new Date().toISOString().slice(0, 7) + '-01';
  const { error } = await supabase.rpc('process_monthly_tuition', {
    p_billing_month: month,
  });
  if (error) throw new Error(error.message);
}
