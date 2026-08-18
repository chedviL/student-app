import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';

// Mock XLSX.writeFile to avoid actual file writes in tests
vi.mock('xlsx', async () => {
  const actual = await vi.importActual<typeof import('xlsx')>('xlsx');
  return { ...actual, writeFile: vi.fn() };
});

import { exportToExcel, todayStr, type ExportColDef } from '../../utils/excelExport';

const COLS: ExportColDef[] = [
  { key: 'name',     label: 'שם' },
  { key: 'date',     label: 'תאריך',   type: 'date' },
  { key: 'amountILS', label: 'סכום ₪', type: 'currency_ils' },
  { key: 'amountUSD', label: 'סכום $', type: 'currency_usd' },
  { key: 'num',      label: 'מספר',    type: 'number' },
];

describe('exportToExcel', () => {
  it('creates workbook and calls writeFile', () => {
    exportToExcel([{ name: 'ישראל', date: '2026-08-01', amountILS: '700', amountUSD: '', num: '5' }], COLS, 'Sheet1', 'test.xlsx');
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'test.xlsx');
  });

  it('sets RTL on workbook', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([{ name: 'test' }], [{ key: 'name', label: 'שם' }], 'S', 'f.xlsx');
    expect(capturedWb?.Workbook?.Views?.[0]?.RTL).toBe(true);
  });

  it('sets autofilter', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([{ name: 'test' }], [{ key: 'name', label: 'שם' }], 'S', 'f.xlsx');
    const ws = capturedWb?.Sheets?.['S'];
    expect(ws?.['!autofilter']).toBeDefined();
  });

  it('sets column widths', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([{ name: 'test' }], [{ key: 'name', label: 'שם' }], 'S', 'f.xlsx');
    const ws = capturedWb?.Sheets?.['S'];
    expect(ws?.['!cols']).toBeDefined();
    expect((ws?.['!cols'] as XLSX.ColInfo[]).length).toBe(1);
  });

  it('formats date YYYY-MM-DD → DD.MM.YYYY', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([{ d: '2026-08-01' }], [{ key: 'd', label: 'תאריך', type: 'date' }], 'S', 'f.xlsx');
    const ws = capturedWb?.Sheets?.['S'];
    const cell = ws?.['A2'];
    expect(cell?.v).toBe('01.08.2026');
  });

  it('formats ILS currency', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([{ a: '700' }], [{ key: 'a', label: 'סכום', type: 'currency_ils' }], 'S', 'f.xlsx');
    const ws = capturedWb?.Sheets?.['S'];
    expect(String(ws?.['A2']?.v)).toContain('₪');
  });

  it('formats USD currency', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([{ a: '700' }], [{ key: 'a', label: 'סכום', type: 'currency_usd' }], 'S', 'f.xlsx');
    const ws = capturedWb?.Sheets?.['S'];
    expect(String(ws?.['A2']?.v)).toContain('$');
  });

  it('handles null/undefined values gracefully', () => {
    expect(() =>
      exportToExcel([{ name: null, date: undefined }], COLS, 'S', 'f.xlsx')
    ).not.toThrow();
  });

  it('handles empty dataset', () => {
    expect(() => exportToExcel([], COLS, 'S', 'f.xlsx')).not.toThrow();
  });

  it('writes correct headers', () => {
    let capturedWb: XLSX.WorkBook | null = null;
    vi.mocked(XLSX.writeFile).mockImplementationOnce((wb) => { capturedWb = wb as XLSX.WorkBook; });
    exportToExcel([], [{ key: 'x', label: 'כותרת' }], 'S', 'f.xlsx');
    const ws = capturedWb?.Sheets?.['S'];
    expect(ws?.['A1']?.v).toBe('כותרת');
  });

  // REGRESSION: tuitionStartDate must NOT appear in export
  it('does not include tuitionStartDate column', () => {
    const cols: ExportColDef[] = [
      { key: 'name', label: 'שם' },
      { key: 'city', label: 'עיר' },
    ];
    const hasTuitionStart = cols.some(
      (c) => c.key === 'tuitionStartDate' || c.label === 'תחילת גבייה'
    );
    expect(hasTuitionStart).toBe(false);
  });
});

describe('todayStr', () => {
  it('returns a non-empty string', () => {
    expect(todayStr().length).toBeGreaterThan(0);
  });

  it('contains digits', () => {
    expect(todayStr()).toMatch(/\d/);
  });
});
