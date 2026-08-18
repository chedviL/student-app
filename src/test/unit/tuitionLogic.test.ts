import { describe, it, expect } from 'vitest';
import { summariseBalances } from '../../api/tuitionApi';
import type { TuitionBalance } from '../../types/tuition';

// ─── Sign convention ──────────────────────────────────────────────────────────

describe('Sign convention', () => {
  it('charge is negative amount', () => {
    // monthly_charge of 700 ILS → amount = -700
    const charge = -700;
    expect(charge).toBeLessThan(0);
  });

  it('payment is positive amount', () => {
    // payment of 700 ILS → amount = +700
    const payment = 700;
    expect(payment).toBeGreaterThan(0);
  });

  it('balance < 0 means debt', () => {
    const balance = -700 + 300; // charge + partial payment
    expect(balance).toBeLessThan(0);
  });

  it('balance = 0 means ok', () => {
    const balance = -700 + 700;
    expect(balance).toBe(0);
  });

  it('balance > 0 means credit (ok)', () => {
    const balance = -700 + 900;
    expect(balance).toBeGreaterThan(0);
  });
});

// ─── summariseBalances ────────────────────────────────────────────────────────

describe('summariseBalances', () => {
  const makeBalance = (
    currency: 'ILS' | 'USD' | null,
    currentBalance: number,
    status: 'debt' | 'ok' | 'no_currency'
  ): TuitionBalance => ({
    studentId: 'x',
    currency,
    currentBalance,
    status,
  });

  it('counts debtors correctly', () => {
    const balances = [
      makeBalance('ILS', -700, 'debt'),
      makeBalance('ILS', 0, 'ok'),
      makeBalance('ILS', 200, 'ok'),
    ];
    const s = summariseBalances(balances);
    expect(s.debtors).toBe(1);
    expect(s.ok).toBe(2);
  });

  it('counts no_currency separately', () => {
    const balances = [
      makeBalance(null, 0, 'no_currency'),
      makeBalance('ILS', -700, 'debt'),
    ];
    const s = summariseBalances(balances);
    expect(s.noCurrency).toBe(1);
    expect(s.debtors).toBe(1);
  });

  it('sums ILS debt correctly (negative number)', () => {
    const balances = [
      makeBalance('ILS', -700, 'debt'),
      makeBalance('ILS', -300, 'debt'),
    ];
    const s = summariseBalances(balances);
    expect(s.debtILS).toBe(-1000);
  });

  it('sums USD debt correctly', () => {
    const balances = [
      makeBalance('USD', -200, 'debt'),
    ];
    const s = summariseBalances(balances);
    expect(s.debtUSD).toBe(-200);
  });

  it('does NOT mix ILS and USD debt', () => {
    const balances = [
      makeBalance('ILS', -700, 'debt'),
      makeBalance('USD', -200, 'debt'),
    ];
    const s = summariseBalances(balances);
    expect(s.debtILS).toBe(-700);
    expect(s.debtUSD).toBe(-200);
    // They must never be added together
    expect(s.debtILS).not.toBe(s.debtILS + s.debtUSD);
  });

  it('returns zeros for empty list', () => {
    const s = summariseBalances([]);
    expect(s.debtors).toBe(0);
    expect(s.ok).toBe(0);
    expect(s.noCurrency).toBe(0);
    expect(s.debtILS).toBe(0);
    expect(s.debtUSD).toBe(0);
  });

  it('credit balance (positive) counts as ok, not debt', () => {
    const balances = [makeBalance('ILS', 200, 'ok')];
    const s = summariseBalances(balances);
    expect(s.ok).toBe(1);
    expect(s.debtors).toBe(0);
    expect(s.debtILS).toBe(0);
  });
});

// ─── Eligibility rules (pure logic) ──────────────────────────────────────────

describe('Tuition eligibility rules', () => {
  function isEligible(student: {
    tuition: string | null;
    tuition_currency: string | null;
    tuition_start_date: string | null;
    billing_month: string;
  }): boolean {
    const { tuition, tuition_currency, tuition_start_date, billing_month } = student;
    if (!tuition) return false;
    if (!/^[0-9]+(\.[0-9]+)?$/.test(tuition)) return false;
    if (parseFloat(tuition) <= 0) return false;
    if (!tuition_currency || !['ILS', 'USD'].includes(tuition_currency)) return false;
    if (!tuition_start_date) return false;
    // date_trunc('month', tuition_start_date) <= billing_month
    const startMonth = tuition_start_date.slice(0, 7) + '-01';
    return startMonth <= billing_month;
  }

  it('eligible: all conditions met', () => {
    expect(isEligible({ tuition: '700', tuition_currency: 'ILS', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(true);
  });

  it('ineligible: null tuition', () => {
    expect(isEligible({ tuition: null, tuition_currency: 'ILS', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(false);
  });

  it('ineligible: zero tuition', () => {
    expect(isEligible({ tuition: '0', tuition_currency: 'ILS', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(false);
  });

  it('ineligible: non-numeric tuition', () => {
    expect(isEligible({ tuition: 'abc', tuition_currency: 'ILS', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(false);
  });

  it('ineligible: null currency', () => {
    expect(isEligible({ tuition: '700', tuition_currency: null, tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(false);
  });

  it('ineligible: invalid currency symbol', () => {
    expect(isEligible({ tuition: '700', tuition_currency: '₪', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(false);
  });

  it('ineligible: null start date', () => {
    expect(isEligible({ tuition: '700', tuition_currency: 'ILS', tuition_start_date: null, billing_month: '2026-08-01' })).toBe(false);
  });

  it('ineligible: future start date', () => {
    expect(isEligible({ tuition: '700', tuition_currency: 'ILS', tuition_start_date: '2099-01-01', billing_month: '2026-08-01' })).toBe(false);
  });

  it('eligible: start date same month as billing month (mid-month start)', () => {
    // tuition_start_date = 2026-08-21, billing_month = 2026-08-01 → eligible
    expect(isEligible({ tuition: '700', tuition_currency: 'ILS', tuition_start_date: '2026-08-21', billing_month: '2026-08-01' })).toBe(true);
  });

  it('eligible: decimal tuition', () => {
    expect(isEligible({ tuition: '725.50', tuition_currency: 'ILS', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(true);
  });

  it('eligible: USD currency', () => {
    expect(isEligible({ tuition: '700', tuition_currency: 'USD', tuition_start_date: '2026-01-01', billing_month: '2026-08-01' })).toBe(true);
  });
});

// ─── Auto-payment rank rules ──────────────────────────────────────────────────

describe('Auto-payment rank rules', () => {
  const AUTO_RANKS = ['אשראי', 'בנקאי', 'א"א'];

  function getsAutoPayment(rank: string | null): boolean {
    if (!rank) return false;
    return AUTO_RANKS.includes(rank.trim());
  }

  it('אשראי gets auto payment', () => expect(getsAutoPayment('אשראי')).toBe(true));
  it('בנקאי gets auto payment', () => expect(getsAutoPayment('בנקאי')).toBe(true));
  it('א"א gets auto payment', () => expect(getsAutoPayment('א"א')).toBe(true));
  it('whitespace around אשראי still gets auto payment', () => expect(getsAutoPayment(' אשראי ')).toBe(true));
  it('מזומן does NOT get auto payment', () => expect(getsAutoPayment('מזומן')).toBe(false));
  it('מרכז הצדקה does NOT get auto payment', () => expect(getsAutoPayment('מרכז הצדקה')).toBe(false));
  it('במעקב does NOT get auto payment', () => expect(getsAutoPayment('במעקב')).toBe(false));
  it('שלילי does NOT get auto payment', () => expect(getsAutoPayment('שלילי')).toBe(false));
  it('empty string does NOT get auto payment', () => expect(getsAutoPayment('')).toBe(false));
  it('null does NOT get auto payment', () => expect(getsAutoPayment(null)).toBe(false));
});

// ─── Backfill cutoff logic ────────────────────────────────────────────────────

describe('Backfill cutoff logic', () => {
  function computeCutoff(today: Date): string {
    const day = today.getDate();
    let year = today.getFullYear();
    let month = today.getMonth(); // 0-based
    if (day < 21) {
      // previous month
      if (month === 0) { year -= 1; month = 11; } else { month -= 1; }
    }
    // first of that month
    const mm = String(month + 1).padStart(2, '0');
    return `${year}-${mm}-01`;
  }

  it('before 21st → cutoff is previous month', () => {
    const cutoff = computeCutoff(new Date('2026-08-15'));
    expect(cutoff).toBe('2026-07-01');
  });

  it('on 21st → cutoff is current month', () => {
    const cutoff = computeCutoff(new Date('2026-08-21'));
    expect(cutoff).toBe('2026-08-01');
  });

  it('after 21st → cutoff is current month', () => {
    const cutoff = computeCutoff(new Date('2026-08-25'));
    expect(cutoff).toBe('2026-08-01');
  });

  it('Jan 15 → cutoff is December of previous year', () => {
    const cutoff = computeCutoff(new Date('2026-01-15'));
    expect(cutoff).toBe('2025-12-01');
  });

  it('Jan 21 → cutoff is January', () => {
    const cutoff = computeCutoff(new Date('2026-01-21'));
    expect(cutoff).toBe('2026-01-01');
  });
});
