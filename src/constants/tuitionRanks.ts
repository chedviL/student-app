// ─── דירוגי תשלום (tuition_rank) ─────────────────────────────────────────────
// מקור אמת יחיד בצד הלקוח. חייב להיות זהה לרשימה ב-SQL:
//   supabase/migration_v5_tuition_integrity.sql → public.tuition_auto_credit_ranks()
// בדיקה אוטומטית (tuitionRanks.test.ts) מוודאת שהקבצים מסונכרנים.

/** דירוגים שזכאים לזיכוי אוטומטי ב-21 לחודש. אין לשנות ללא אישור הלקוח. */
export const AUTO_CREDIT_RANKS = ['אשראי', 'בנקאי', 'קירוב לבבות', 'מרכז הצדקה'] as const;

/** דירוגים ללא זיכוי אוטומטי — חיוב בלבד עד לרישום תשלום ידני. */
export const NON_AUTO_CREDIT_RANKS = ['מזומן', 'א"א', 'שלילי'] as const;

/** כל הדירוגים שמוצגים לבחירה בעורכי שכר הלימוד. */
export const TUITION_RANK_OPTIONS: readonly string[] = [...AUTO_CREDIT_RANKS, ...NON_AUTO_CREDIT_RANKS];

export function isAutoCreditRank(rank: string | null | undefined): boolean {
  if (!rank) return false;
  return (AUTO_CREDIT_RANKS as readonly string[]).includes(rank.trim());
}

/**
 * אפשרויות לתפריט בחירה: כל הדירוגים המוכרים, ובנוסף הערך הנוכחי אם אינו מוכר
 * (למשל "כן" מנתונים ישנים). כך פתיחת העורך לעולם לא "מאבדת" ערך קיים בשקט.
 */
export function rankOptionsFor(current: string | null | undefined): string[] {
  const opts = [...TUITION_RANK_OPTIONS];
  const cur = (current ?? '').trim();
  if (cur && !opts.includes(cur)) opts.push(cur);
  return opts;
}
