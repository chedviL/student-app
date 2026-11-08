import type { Student } from "../types/student";

export function getFullName(student: Student): string {
  return `${student.firstName} ${student.lastName}`;
}

/**
 * מחזיר רק את השדות ששונו בטיוטה ביחס למקור.
 * מונע שליחת ערכים ישנים (stale) של שדות שהמשתמש לא נגע בהם —
 * למשל דריסת tuition_start_date ששוחזר ב-DB אחרי שהכרטיס נפתח.
 */
export function diffStudent(original: Student, draft: Partial<Student>): Partial<Student> {
  const patch: Partial<Student> = {};
  for (const key of Object.keys(draft) as (keyof Student)[]) {
    if (key === "id") continue;
    const before = original[key] ?? "";
    const after = draft[key] ?? "";
    if (before !== after) (patch as Record<string, unknown>)[key] = draft[key];
  }
  return patch;
}
