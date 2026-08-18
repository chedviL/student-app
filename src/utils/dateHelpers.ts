/**
 * Formats a date string to DD.MM.YYYY.
 * Handles: YYYY-MM-DD, DD.MM.YYYY (passthrough), MM/DD/YYYY, Excel serial numbers.
 * Returns "לא הוגדר" for null/undefined/empty.
 */
export function formatDate(val: string | null | undefined): string {
  if (!val) return 'לא הוגדר';
  if (val.includes('.')) return val;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2].padStart(2,'0')}.${m2[1].padStart(2,'0')}.${m2[3]}`;
  const n = Number(val);
  if (!isNaN(n) && n > 1000 && n < 100000) {
    const d = new Date(new Date(1899, 11, 30).getTime() + n * 86400000);
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  }
  return val;
}

/**
 * Same as formatDate but returns empty string instead of "לא הוגדר" for missing values.
 * Useful for table cells where empty is preferred over text.
 */
export function formatDateOrEmpty(val: string | null | undefined): string {
  if (!val) return '';
  return formatDate(val);
}
