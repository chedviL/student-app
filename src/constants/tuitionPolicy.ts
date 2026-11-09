// ─── מדיניות תאריך תחילת גבייה ───────────────────────────────────────────────
// מקור אמת יחיד לכללים ולהסברים שמוצגים למזכירות. שינוי מדיניות — כאן בלבד.

/** תאריך תחילת השנה (20.08.2026) — מוצג כמידע בלבד; לא מוגדר אוטומטית לאף תלמיד. */
export const SCHOOL_YEAR_START_DATE = '2026-08-20';

/**
 * החיוב החודשי: pg_cron ‏'0 2 21 * *' עם cron.timezone=GMT — כלומר ב-21 לחודש ב-02:00 UTC
 * (04:00 שעון חורף / 05:00 שעון קיץ בישראל), עבור החודש של current_date ב-UTC.
 */
export const CHARGE_RUN_DAY = 21;
export const CHARGE_RUN_HOUR_UTC = 2;

export const AUTO_CREDIT_RANKS_TEXT = 'אשראי, בנקאי, קירוב לבבות, מרכז הצדקה';

export const START_DATE_POLICY: readonly string[] = [
  'תאריך תחילת הגבייה חייב לשקף את תחילת החיוב האמיתית של התלמיד. אין לקבוע תאריך "ברירת מחדל" בלי לבדוק את זכאותו ואת מועד תחילת החיוב שלו.',
  'תלמיד בלי תאריך לא מחויב בחיוב החודשי — יש לבדוק כל מקרה ולקבוע תאריך פרטני.',
  `החיוב החודשי נוצר אוטומטית ב-${CHARGE_RUN_DAY} לכל חודש, עבור החודש הנוכחי בלבד. זיכוי אוטומטי ניתן רק לדירוגים: ${AUTO_CREDIT_RANKS_TEXT}.`,
  'שינוי תאריך אינו מתקן תנועות היסטוריות אוטומטית — הוא משפיע רק מהחיוב הבא.',
  'השלמת חודשים קודמים תבוצע רק לאחר בדיקת כפילויות ואישור המנהלת, באמצעות חיוב ידני מתועד או שחזור מבוקר.',
  'אין למחוק תנועות כספיות קיימות. תיקונים יתועדו באמצעות ביטול התנועה עם סיבה.',
  'אין למחוק תאריך התחלה (המערכת חוסמת זאת). תלמיד שהפסיק לשלם: שכר לימוד 0 או העברה לבוגרים.',
  'שינוי תאריך לקבוצת תלמידים: רק לאחר בדיקה — המערכת מציגה את ההשלכות לכל קבוצת תלמידים בנפרד.',
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const HE_MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function formatHe(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function monthIndex(iso: string): number {
  const [y, m] = iso.split('-').map(Number);
  return y * 12 + (m - 1);
}

function monthLabel(idx: number): string {
  return `${HE_MONTHS[idx % 12]} ${Math.floor(idx / 12)}`;
}

function monthsBetween(fromIdx: number, toIdxExclusive: number): string[] {
  const out: string[] = [];
  for (let i = fromIdx; i < toIdxExclusive; i++) out.push(monthLabel(i));
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The next automatic run, computed exactly like pg_cron: the 21st at 02:00 UTC.
 * Independent of the browser's time zone. `israelTime` is for display only.
 */
export function nextChargeRun(now: Date): { date: string; monthIdx: number; israelTime: string; runAt: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const thisRun = Date.UTC(y, m, CHARGE_RUN_DAY, CHARGE_RUN_HOUR_UTC, 0, 0);
  const idx = y * 12 + m + (now.getTime() >= thisRun ? 1 : 0);
  const runAt = new Date(Date.UTC(Math.floor(idx / 12), idx % 12, CHARGE_RUN_DAY, CHARGE_RUN_HOUR_UTC));
  const yy = Math.floor(idx / 12);
  const mm = String((idx % 12) + 1).padStart(2, '0');
  const israelTime = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false }).format(runAt);
  return { date: `${CHARGE_RUN_DAY}.${mm}.${yy}`, monthIdx: idx, israelTime, runAt };
}

/** Suggested start date for a NEW student: the 20th of the month the next run will charge. Must be confirmed explicitly. */
export function suggestStartDate(now: Date = new Date()): string {
  const { monthIdx } = nextChargeRun(now);
  return `${Math.floor(monthIdx / 12)}-${String((monthIdx % 12) + 1).padStart(2, '0')}-20`;
}

export type StartDateChangeKind = 'blocked' | 'invalid' | 'no_effect' | 'set_new' | 'later' | 'earlier';

export interface StartDateChangeExplanation {
  kind: StartDateChangeKind;
  title: string;
  consequences: string[];
  whatToDo: string[];
}

/**
 * Pure: explains the financial consequences of changing a student's start date.
 * Billing works per month: a student is charged for month M if the start date's month ≤ M.
 */
export function describeStartDateChange(
  oldDate: string | null | undefined,
  newDate: string | null | undefined,
  today: Date = new Date(),
): StartDateChangeExplanation {
  const before = oldDate && ISO.test(oldDate) ? oldDate : null;
  const after = newDate && newDate.trim() !== '' ? newDate.trim() : null;
  const run = nextChargeRun(today);

  if (!after) {
    return {
      kind: 'blocked',
      title: 'לא ניתן למחוק תאריך תחילת גבייה',
      consequences: ['תלמיד בלי תאריך לא מחויב בכלל — החיוב החודשי מדלג עליו בלי התראה.', 'המערכת חוסמת מחיקה של תאריך קיים.'],
      whatToDo: ['כדי לשנות — הזינו תאריך אחר.', 'תלמיד שהפסיק לשלם: שכר לימוד 0 או העברה לבוגרים.'],
    };
  }
  if (!ISO.test(after)) {
    return { kind: 'invalid', title: 'תאריך לא תקין', consequences: ['יש להזין תאריך מלא (יום, חודש, שנה).'], whatToDo: [] };
  }

  const newIdx = monthIndex(after);
  const firstCharge = newIdx >= run.monthIdx
    ? `החיוב האוטומטי הראשון: ${CHARGE_RUN_DAY}.${after.slice(5, 7)}.${after.slice(0, 4)} (עבור ${monthLabel(newIdx)}).`
    : `התלמיד ייכלל בחיוב הבא: ${run.date} בשעה ${run.israelTime} (עבור ${monthLabel(run.monthIdx)}).`;

  if (!before) {
    const missed = newIdx < run.monthIdx ? monthsBetween(newIdx, run.monthIdx) : [];
    return {
      kind: 'set_new',
      title: `קביעת תאריך תחילת גבייה: ${formatHe(after)}`,
      consequences: [
        firstCharge,
        ...(missed.length ? [`חודשים שכבר עברו (${missed.join(', ')}) לא יחויבו אוטומטית.`] : []),
      ],
      whatToDo: missed.length
        ? ['אם התלמיד היה אמור לשלם על החודשים שעברו — חיוב ידני לכל חודש עם הערה, לאחר אישור המנהלת.']
        : [],
    };
  }

  const oldIdx = monthIndex(before);
  if (newIdx === oldIdx) {
    return {
      kind: 'no_effect',
      title: 'אין השפעה על החיובים',
      consequences: ['החיוב נקבע לפי החודש, והחודש לא השתנה.'],
      whatToDo: [],
    };
  }

  if (newIdx > oldIdx) {
    const dropped = monthsBetween(oldIdx, Math.min(newIdx, run.monthIdx));
    return {
      kind: 'later',
      title: `דחיית תחילת הגבייה מ-${formatHe(before)} ל-${formatHe(after)}`,
      consequences: [
        newIdx > run.monthIdx
          ? `התלמיד לא יחויב בחיוב הקרוב (${run.date}). ${firstCharge}`
          : firstCharge,
        ...(dropped.length
          ? [`חיובים שכבר נוצרו לחודשים ${dropped.join(', ')} לא יבוטלו אוטומטית.`]
          : []),
      ],
      whatToDo: dropped.length
        ? ['בדקו בכרטיס התלמיד אם קיימים חיובים לחודשים האלה. אם התלמיד לא היה אמור לשלם — בטלו כל חיוב (לא מחיקה) עם סיבה.']
        : [],
    };
  }

  const added = monthsBetween(newIdx, Math.min(oldIdx, run.monthIdx));
  return {
    kind: 'earlier',
    title: `הקדמת תחילת הגבייה מ-${formatHe(before)} ל-${formatHe(after)}`,
    consequences: [
      firstCharge,
      ...(added.length ? [`החודשים ${added.join(', ')} לא יחויבו אוטומטית — המערכת מחייבת רק את החודש הנוכחי.`] : []),
    ],
    whatToDo: added.length
      ? ['אם התלמיד היה אמור לשלם על החודשים האלה — חיוב ידני לכל חודש עם הערה "חודש MM/YY", לאחר אישור המנהלת.']
      : [],
  };
}

export interface StartDateChangeGroup {
  oldDate: string | null;
  count: number;
  explanation: StartDateChangeExplanation;
}

/**
 * Bulk change: students may have different current dates, so the consequences are
 * computed for EVERY distinct current date (not only the first student's).
 */
export function describeBulkStartDateChange(
  currentDates: ReadonlyArray<string | null | undefined>,
  newDate: string | null | undefined,
  today: Date = new Date(),
): StartDateChangeGroup[] {
  const counts = new Map<string | null, number>();
  for (const d of currentDates) {
    const k = d && ISO.test(d) ? d : null;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
    .map(([oldDate, count]) => ({ oldDate, count, explanation: describeStartDateChange(oldDate, newDate, today) }));
}
