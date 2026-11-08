import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

vi.mock('../../lib/supabaseClient', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));

import { fetchAllPages, deriveAutoChargeState } from '../../api/tuitionApi';
import {
  AUTO_CREDIT_RANKS, NON_AUTO_CREDIT_RANKS, isAutoCreditRank, rankOptionsFor,
} from '../../constants/tuitionRanks';

describe('auto-credit rank rules (approved by client)', () => {
  it('exactly the four approved ranks get an automatic credit', () => {
    expect([...AUTO_CREDIT_RANKS].sort()).toEqual(['אשראי', 'בנקאי', 'מרכז הצדקה', 'קירוב לבבות'].sort());
  });
  it.each(['אשראי', 'בנקאי', 'קירוב לבבות', 'מרכז הצדקה', ' אשראי '])('%s → credit', (r) => {
    expect(isAutoCreditRank(r)).toBe(true);
  });
  it.each(['מזומן', 'א"א', 'שלילי', 'כן', '', null, undefined, 'אשראי בנקאי'])('%s → no credit', (r) => {
    expect(isAutoCreditRank(r as string)).toBe(false);
  });
  it('א"א is NOT an auto-credit rank (old SQL wrongly credited it)', () => {
    expect(NON_AUTO_CREDIT_RANKS).toContain('א"א');
    expect(isAutoCreditRank('א"א')).toBe(false);
  });
  it('rankOptionsFor keeps an unknown current value', () => {
    expect(rankOptionsFor('כן')).toContain('כן');
    expect(rankOptionsFor('אשראי').filter((r) => r === 'אשראי')).toHaveLength(1);
  });

  it.each([
    'supabase/migration_v5_tuition_integrity.sql',
    'supabase/recovery/src/core.sql',
  ])('client list is identical to the SQL list in %s', (file) => {
    const sql = readFileSync(resolve(__dirname, '../../..', file), 'utf8');
    const m = sql.match(/-- AUTO_CREDIT_RANKS:BEGIN([\s\S]*?)-- AUTO_CREDIT_RANKS:END/);
    expect(m).not.toBeNull();
    const sqlRanks = [...m![1].matchAll(/'((?:[^']|'')+)'/g)].map((x) => x[1].replace(/''/g, "'"));
    expect(sqlRanks.sort()).toEqual([...AUTO_CREDIT_RANKS].sort());
  });

  it('generated recovery SQL files are up to date with src/', () => {
    const out = spawnSync(process.execPath, [resolve(__dirname, '../../../scripts/build-recovery-sql.mjs'), '--check'], { encoding: 'utf8' });
    expect(out.stderr).toBe('');
    expect(out.status).toBe(0);
  });
});

describe('fetchAllPages — PostgREST max_rows must not hide transactions', () => {
  it('fetches beyond 1000 rows (1275 like production)', async () => {
    const total = 1275;
    const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
    const calls: Array<[number, number]> = [];
    const result = await fetchAllPages((from, to) => {
      calls.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    });
    expect(result).toHaveLength(total);
    expect(calls).toEqual([[0, 999], [1000, 1999]]);
  });
  it('exact multiple of page size ends with an empty page', async () => {
    const rows = Array.from({ length: 4 }, (_, i) => i);
    const result = await fetchAllPages((f, t) => Promise.resolve({ data: rows.slice(f, t + 1), error: null }), 2);
    expect(result).toEqual([0, 1, 2, 3]);
  });
  it('propagates errors (never returns partial data silently)', async () => {
    await expect(
      fetchAllPages(() => Promise.resolve({ data: null, error: { message: 'permission denied' } })),
    ).rejects.toThrow('permission denied');
  });
});

describe('deriveAutoChargeState — overview badge never claims unobserved success', () => {
  const d = (s: string) => new Date(`${s}T12:00:00`);
  it('current month exists → ok', () => expect(deriveAutoChargeState('2026-11-01', d('2026-11-25'))).toBe('ok'));
  it('before the 21st, previous month exists → pending', () =>
    expect(deriveAutoChargeState('2026-10-01', d('2026-11-08'))).toBe('pending'));
  it('after the 21st, current month missing → missing', () =>
    expect(deriveAutoChargeState('2026-10-01', d('2026-11-22'))).toBe('missing'));
  it('two months behind → missing', () =>
    expect(deriveAutoChargeState('2026-09-01', d('2026-11-08'))).toBe('missing'));
  it('no charges ever → never', () => expect(deriveAutoChargeState(null, d('2026-11-08'))).toBe('never'));
});
