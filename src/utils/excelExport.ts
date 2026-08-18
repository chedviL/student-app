import * as XLSX from 'xlsx';

export type ExportColDef = {
  key: string;
  label: string;
  type?: 'date' | 'currency_ils' | 'currency_usd' | 'number' | 'text';
};

function formatCellValue(raw: unknown, type?: ExportColDef['type']): string | number {
  const str = String(raw ?? '');
  if (!str) return '';

  if (type === 'date') {
    // YYYY-MM-DD → DD.MM.YYYY
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    // Excel serial
    const n = Number(str);
    if (!isNaN(n) && n > 1000 && n < 100000) {
      const d = new Date(new Date(1899, 11, 30).getTime() + n * 86400000);
      return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    }
    return str;
  }

  if (type === 'currency_ils') {
    const n = parseFloat(str);
    if (!isNaN(n)) return `${n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₪`;
    return str;
  }

  if (type === 'currency_usd') {
    const n = parseFloat(str);
    if (!isNaN(n)) return `$${n.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    return str;
  }

  if (type === 'number') {
    const n = parseFloat(str);
    if (!isNaN(n)) return n;
    return str;
  }

  return str;
}

export function exportToExcel<T extends Record<string, unknown>>(
  rows: T[],
  cols: ExportColDef[],
  sheetName: string,
  fileName: string,
) {
  const headers = cols.map((c) => c.label);

  const dataRows = rows.map((row) =>
    cols.map((c) => formatCellValue(row[c.key], c.type))
  );

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  // Auto column widths — based on content
  ws['!cols'] = cols.map((c, i) => ({
    wch: Math.max(
      c.label.length + 4,
      ...dataRows.map((r) => String(r[i] ?? '').length + 2),
      10,
    ),
  }));

  // AutoFilter on header row
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: cols.length - 1 } }) };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // RTL workbook view
  wb.Workbook = { Views: [{ RTL: true }] };

  XLSX.writeFile(wb, fileName);
}

export function todayStr(): string {
  return new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
}
