// ─── מדיניות תאריך תחילת גבייה ───────────────────────────────────────────────
// מקור אמת יחיד לכללים ולהסברים שמוצגים למזכירות. שינוי מדיניות — כאן בלבד.

/** התאריך שנקבע לכל התלמידים (החלטת הלקוחה, 08.11.2026). */
export const DEFAULT_TUITION_START_DATE = '2026-08-20';

/** החיוב החודשי רץ ב-21 לחודש ב-02:00 UTC עבור החודש הנוכחי (ערך החיוב 20, ערך הזיכוי 21). */
export const CHARGE_RUN_DAY = 21;

export const AUTO_CREDIT_RANKS_TEXT = 'אשראי, בנקאי, קירוב לבבות, מרכז הצדקה';

export const START_DATE_POLICY: readonly string[] = [
  `לכל תלמיד חייב להיות תאריך תחילת גבייה. ברירת המחדל היא ${formatHe(DEFAULT_TUITION_START_DATE)} — התאריך של כל התלמידים.`,
  'תלמיד שמצטרף באמצע השנה: התאריך הוא ה-20 בחודש שבו מתחיל החיוב שלו.',
  `החיוב החודשי נוצר אוטומטית ב-${CHARGE_RUN_DAY} לכל חודש, עבור החודש הנוכחי בלבד. זיכוי אוטומטי ניתן רק לדירוגים: ${AUTO_CREDIT_RANKS_TEXT}.`,
  'שינוי תאריך משפיע רק מהחיוב הבא. הוא לא יוצר ולא מבטל חיובים שכבר נוצרו.',
  'חודשים קודמים שלא חויבו: חיוב ידני לכל חודש, עם הערה "חודש MM/YY", לאחר אישור המנהלת.',
  'חיוב שנוצר לפני שהתלמיד היה אמור להתחיל: ביטול התנועה (לא מחיקה) עם סיבה.',
  'אין למחוק תאריך התחלה (המערכת חוסמת זאת). תלמיד שהפסיק לשלם: שכר לימוד 0 או העברה לבוגרים.',
  'שינוי תאריך לקבוצת תלמידים: רק לאחר בדיקה — המערכת מציגה כמה תלמידים יושפעו.',
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

/** The next automatic run (21st of this month, or of next month if already past). */
export function nextChargeRun(today: Date): { date: string; monthIdx: number } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const passed = today.getDate() > CHARGE_RUN_DAY || (today.getDate() === CHARGE_RUN_DAY && today.getHours() >= 5);
  const idx = y * 12 + m + (passed ? 1 : 0);
  const yy = Math.floor(idx / 12);
  const mm = String((idx % 12) + 1).padStart(2, '0');
  return { date: `${CHARGE_RUN_DAY}.${mm}.${yy}`, monthIdx: idx };
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
    : `התלמיד ייכלל בחיוב הבא: ${run.date} (עבור ${monthLabel(run.monthIdx)}).`;

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
