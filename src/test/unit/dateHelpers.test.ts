import { describe, it, expect } from 'vitest';
import { formatDate, formatDateOrEmpty } from '../../utils/dateHelpers';

describe('formatDate', () => {
  it('returns לא הוגדר for null', () => {
    expect(formatDate(null)).toBe('לא הוגדר');
  });

  it('returns לא הוגדר for undefined', () => {
    expect(formatDate(undefined)).toBe('לא הוגדר');
  });

  it('returns לא הוגדר for empty string', () => {
    expect(formatDate('')).toBe('לא הוגדר');
  });

  it('converts YYYY-MM-DD to DD.MM.YYYY', () => {
    expect(formatDate('2026-08-21')).toBe('21.08.2026');
  });

  it('passes through DD.MM.YYYY unchanged', () => {
    expect(formatDate('21.08.2026')).toBe('21.08.2026');
  });

  it('converts MM/DD/YYYY to DD.MM.YYYY', () => {
    expect(formatDate('8/21/2026')).toBe('21.08.2026');
  });

  it('converts Excel serial number to date', () => {
    // Excel serial 46000 = some valid date
    const result = formatDate('46000');
    expect(result).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
  });

  it('returns raw string for unrecognized format', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('handles January correctly', () => {
    expect(formatDate('2026-01-01')).toBe('01.01.2026');
  });

  it('handles December correctly', () => {
    expect(formatDate('2026-12-31')).toBe('31.12.2026');
  });

  it('handles leap year Feb 29', () => {
    expect(formatDate('2024-02-29')).toBe('29.02.2024');
  });
});

describe('formatDateOrEmpty', () => {
  it('returns empty string for null', () => {
    expect(formatDateOrEmpty(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatDateOrEmpty(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatDateOrEmpty('')).toBe('');
  });

  it('converts YYYY-MM-DD to DD.MM.YYYY', () => {
    expect(formatDateOrEmpty('2026-08-21')).toBe('21.08.2026');
  });
});
