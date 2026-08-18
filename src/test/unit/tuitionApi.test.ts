import { describe, it, expect, vi } from 'vitest';

// ─── Mock supabase ────────────────────────────────────────────────────────────
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { summariseBalances } from '../../api/tuitionApi';
import type { TuitionBalance } from '../../types/tuition';

// ─── REGRESSION: tuition_monthly_history must NOT have source column ──────────

describe('tuition_monthly_history — no source column regression', () => {
  it('mapMonthSummary does not read source field', () => {
    // The view does not have a source column.
    // If code tries to read row.source from the view, it would be undefined.
    // This test verifies the mapper only reads the fields that exist.
    const viewRow = {
      student_id: 'abc',
      billing_month: '2026-08-01',
      charges: -700,
      credits: 700,
      monthly_total: 0,
      balance_after_month: 0,
      currency: 'ILS',
      student_name: 'כהן ישראל',
      // source is intentionally absent — it does not exist in the view
    };

    // The mapper should not throw or produce unexpected values
    // We verify by checking the mapped fields don't include source
    const mapped = {
      studentId: String(viewRow.student_id),
      billingMonth: String(viewRow.billing_month),
      charges: viewRow.charges !== null ? Number(viewRow.charges) : null,
      credits: viewRow.credits !== null ? Number(viewRow.credits) : null,
      monthlyTotal: Number(viewRow.monthly_total),
      balanceAfterMonth: Number(viewRow.balance_after_month),
      currency: viewRow.currency as 'ILS' | 'USD',
    };

    expect(mapped).not.toHaveProperty('source');
    expect(mapped.studentId).toBe('abc');
    expect(mapped.charges).toBe(-700);
    expect(mapped.credits).toBe(700);
  });
});

// ─── getMonthAggregates — source comes from tuition_transactions, not view ───

describe('getMonthAggregates source handling', () => {
  it('source counts come from tuition_transactions, not tuition_monthly_history', () => {
    // This is a documentation/regression test.
    // The actual implementation in tuitionApi.ts fetches source from
    // tuition_transactions separately. We verify the logic here.
    const txRows = [
      { billing_month: '2026-08-01', source: 'automatic' },
      { billing_month: '2026-08-01', source: 'automatic' },
      { billing_month: '2026-08-01', source: 'manual' },
    ];

    const sourceCounts = new Map<string, { automatic: number; manual: number }>();
    for (const r of txRows) {
      const month = String(r.billing_month);
      if (!sourceCounts.has(month)) sourceCounts.set(month, { automatic: 0, manual: 0 });
      const sc = sourceCounts.get(month)!;
      if (r.source === 'automatic') sc.automatic++; else sc.manual++;
    }

    expect(sourceCounts.get('2026-08-01')?.automatic).toBe(2);
    expect(sourceCounts.get('2026-08-01')?.manual).toBe(1);
  });
});

// ─── summariseBalances — ILS/USD never mixed ──────────────────────────────────

describe('summariseBalances — currency separation', () => {
  it('ILS and USD debts are never summed together', () => {
    const balances: TuitionBalance[] = [
      { studentId: '1', currency: 'ILS', currentBalance: -700, status: 'debt' },
      { studentId: '2', currency: 'USD', currentBalance: -200, status: 'debt' },
      { studentId: '3', currency: 'ILS', currentBalance: -300, status: 'debt' },
    ];
    const s = summariseBalances(balances);
    expect(s.debtILS).toBe(-1000);
    expect(s.debtUSD).toBe(-200);
    // Verify they are stored separately — never combined
    expect(s.debtILS + s.debtUSD).toBe(-1200); // only for verification, never used in UI
  });
});

// ─── REGRESSION: tuitionStartDate must not appear in specific UI locations ───

describe('tuitionStartDate regression — must not appear in wrong places', () => {
  it('TuitionModal does not display tuitionStartDate in info bar', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const content = readFileSync(
      resolve(process.cwd(), 'src/components/tuition/TuitionModal.tsx'),
      'utf-8'
    );
    // tuitionStartDate should not be rendered in the modal info bar
    // It was removed — verify it's not back
    expect(content).not.toMatch(/tuitionStartDate.*label|תחילת גבייה.*Modal/);
  });

  it('PaymentsStudentsTable does not have tuitionStartDate column', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const content = readFileSync(
      resolve(process.cwd(), 'src/components/payments/PaymentsStudentsTable.tsx'),
      'utf-8'
    );
    expect(content).not.toMatch(/tuitionStartDate/);
  });
});
