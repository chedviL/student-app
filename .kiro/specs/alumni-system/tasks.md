# Implementation Plan: Alumni System — מערכת בוגרים

## Overview

מימוש מערכת בוגרים ב-TypeScript/React מעל Supabase. הפיצ'ר מוסיף:
- טבלת `alumni` ב-Supabase (DDL + trigger + RLS)
- פעולת "יצא" אטומית (INSERT → DELETE)
- דף בוגרים עם חיפוש, סינון, עריכה inline וייצוא Excel
- כרטיס בוגר בעיצוב כהה
- ניווט "בוגרים" בנאבבר

כל הקבצים החדשים מחקים את המבנה של עמיתיהם הקיימים (`studentsApi.ts`, `StudentsContext.tsx`, `DatabasePage.tsx`, `StudentCardPage.tsx`).

---

## Tasks

- [ ] 1. SQL — טבלת alumni ב-Supabase
  - [ ] 1.1 צור את קובץ `supabase/alumni_schema.sql`
    - כתוב DDL לטבלת `alumni` עם כל עמודות `students` + `graduated_at timestamptz default now()`
    - הגדר `passport_or_id text unique` בדומה ל-`students`
    - הוסף trigger `alumni_updated_at` שמשתמש בפונקציה הקיימת `update_updated_at()`
    - הוסף מדיניות RLS: `enable row level security` + 4 פוליסות (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) עם `auth.role() = 'authenticated'` — בדומה לפוליסות `students` ב-`supabase/policies.sql`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. TypeScript type + API layer
  - [ ] 2.1 הוסף `Alumni` type ב-`src/types/student.ts`
    - הוסף `siblings` ו-`tuitionStartDate` ל-`Student` interface אם חסרים (בדוק מול schema.sql)
    - הוסף בסוף הקובץ: `export type Alumni = Student & { graduatedAt: string }`
    - _Requirements: 7.4_

  - [ ] 2.2 צור `src/api/alumniApi.ts`
    - העתק מבנה `studentsApi.ts` וכתוב פונקציות: `mapRow` (כולל `graduatedAt: s(row.graduated_at)`), `mapToRow` (ללא `graduated_at`)
    - `getAlumni()` — SELECT * FROM alumni ORDER BY last_name
    - `getAlumnusById(id: string)` — SELECT by uuid
    - `updateAlumnus(id: string, data: Partial<Alumni>)` — UPDATE + return mapped row
    - `graduateStudent(studentId: string)` — שלוף תלמיד → INSERT INTO alumni (כל שדות + `graduated_at: now()`) → אם הצליח: DELETE FROM students; אם INSERT נכשל: throw Error ללא DELETE
    - _Requirements: 7.1, 7.2, 7.3, 2.2, 2.3, 2.4_

  - [ ]* 2.3 כתוב property test — Property 2: אטומיות INSERT לפני DELETE
    - **Property 2: atomicity insert before delete**
    - **Validates: Requirements 2.4, 7.2**
    - השתמש ב-`fast-check`: mock Supabase INSERT ל-reject עם שגיאות שרירותיות; assert שה-DELETE mock לא נקרא
    - _Requirements: 2.4, 7.2_

  - [ ]* 2.4 כתוב property test — Property 4: round-trip מיפוי snake_case ↔ camelCase
    - **Property 4: snake_case camelCase round-trip**
    - **Validates: Requirements 7.3**
    - `fc.record(...)` עם שדות Alumni כולל מחרוזות עם אפסים מובילים ותווים בעברית
    - assert: `mapRow(mapToRow(alumni))` מחזיר ערכים שווים לאובייקט המקורי בכל שדה
    - _Requirements: 7.3_

  - [ ]* 2.5 כתוב property test — Property 1: שמירת שדות בפעולת "יצא"
    - **Property 1: field preservation on graduate**
    - **Validates: Requirements 2.2, 7.2**
    - `fc.record(...)` עם שדות Student שרירותיים; mock Supabase INSERT מחזיר שורה תקינה
    - assert: הערכים שהועברו ל-INSERT שווים לשדות המקוריים; `graduated_at` לא null
    - _Requirements: 2.2, 7.2_

- [ ] 3. StudentsContext — הוספת `removeLocal`
  - [ ] 3.1 עדכן `src/context/StudentsContext.tsx`
    - הוסף `removeLocal: (id: string) => void` לממשק `StudentsState`
    - הוסף פונקציית `removeLocal` עם `useCallback`: `setStudents(prev => prev.filter(s => s.id !== id))`
    - חשוף את `removeLocal` ב-value של ה-Provider
    - _Requirements: 2.5, 3.1_

  - [ ]* 3.2 כתוב property test — Property 3: הסרה מ-UI
    - **Property 3: removeLocal removes exactly one**
    - **Validates: Requirements 2.5, 3.1**
    - `fc.array(studentRecord)` + בחירת id אקראי מהמערך; קרא `removeLocal(id)`
    - assert: `students.find(s => s.id === id) === undefined`; שאר המערך שלם (אורך - 1)
    - _Requirements: 2.5, 3.1_

- [ ] 4. AlumniContext
  - [ ] 4.1 צור `src/context/AlumniContext.tsx`
    - העתק מבנה `StudentsContext.tsx`; שנה ל-`Alumni[]`, השתמש ב-`getAlumni` ו-`updateAlumnus`
    - ממשק `AlumniState`: `{ alumni, loading, error, lastUpdated, refresh, updateLocal }`
    - Supabase Realtime על טבלת `alumni` (INSERT / UPDATE / DELETE) — זהה לתבנית ב-`StudentsContext`
    - חשוף `AlumniProvider` ו-`useAlumni`
    - _Requirements: 4.8, 7.1_

- [ ] 5. Checkpoint — וודא שהקוד עד כאן מתקמפל
  - וודא שאין שגיאות TypeScript ב-`src/types/student.ts`, `src/api/alumniApi.ts`, `src/context/AlumniContext.tsx` ו-`src/context/StudentsContext.tsx`. שאל אם יש שאלות.

- [ ] 6. AlumniPage + AlumniPage.css
  - [ ] 6.1 צור `src/pages/AlumniPage.tsx`
    - העתק מבנה `DatabasePage.tsx`; השתמש ב-`useAlumni` במקום `useStudents` ו-`updateAlumnus` במקום `updateStudent`
    - הוסף עמודה `graduatedAt` read-only עם פורמט `DD.MM.YYYY` בסוף רשימת העמודות (`ALUMNI_COLUMNS`)
    - סטטיסטיקות: סה"כ בוגרים, קהילות ייחודיות, שיעורים ייחודיים
    - חיפוש + סינון (שם משפחה, שם פרטי, שיעור, קהילה, עיר) — זהה ל-`DatabasePage`
    - עריכה inline — `EditableCell` זהה ל-`DatabasePage` (ללא עמודת `graduated_at`)
    - ייצוא Excel: שם קובץ `בוגרים_DD-MM-YYYY.xlsx`, כולל עמודת `graduated_at`, RTL
    - לחיצה על שורה → ניווט ל-`/alumni/:alumniId` (לפי `passport_or_id`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ] 6.2 צור `src/pages/AlumniPage.css`
    - העתק `DatabasePage.css` כנקודת התחלה; החלף prefix `db-` ב-`al-` לסלקטורים ייחודיים לבוגרים
    - שמור על עקביות עם הפלטה הקיימת
    - _Requirements: 4.1_

  - [ ]* 6.3 כתוב property test — Property 5: סינון בוגרים
    - **Property 5: filter results always match query**
    - **Validates: Requirements 4.3, 4.4**
    - `fc.array(alumniRecord)`, `fc.string()` (לא ריק); הרץ פונקציית סינון ב-isolation
    - assert: לכל תוצאה — `lastName.includes(q) || firstName.includes(q) || passportOrId.includes(q)`
    - _Requirements: 4.3, 4.4_

- [ ] 7. AlumniCardPage
  - [ ] 7.1 צור `src/pages/AlumniCardPage.tsx`
    - העתק מבנה `StudentCardPage.tsx`; השתמש ב-`useAlumni` ו-`updateAlumnus`
    - חפש לפי `passport_or_id` מה-params (זהה ל-`StudentCardPage`)
    - הצג שדה "תאריך יציאה" (`graduatedAt`) בכותרת הכרטיס, מתחת לשם, בפורמט `DD.MM.YYYY` — read-only
    - החל עיצוב כהה: CSS variables — `--alumni-card-bg: #1e1e2e`, `--alumni-hero-bg: #2d2d44`, `--alumni-grid-bg: #252538`, `--alumni-text: #e0deff`, `--alumni-accent: #7c6fcd`
    - כפתור "חזרה" → `navigate("/alumni")` (לא `-1`)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 7.2 כתוב property test — Property 6: עיצוב תאריך
    - **Property 6: fmtDate always returns DD.MM.YYYY**
    - **Validates: Requirements 4.7**
    - `fc.date()` → `.toISOString()`, timestamps Excel, מחרוזות DD.MM.YYYY
    - assert: הפלט מתאים ל-regex `/^\d{2}\.\d{2}\.\d{4}$/`
    - _Requirements: 4.7_

- [ ] 8. Navbar + AppRouter — ניווט "בוגרים"
  - [ ] 8.1 עדכן `src/components/common/Navbar.tsx`
    - הוסף `import { GraduationCap } from "lucide-react"` לרשימת ה-imports
    - הוסף לרשימת `NAV_ITEMS`: `{ to: "/alumni", label: "בוגרים", icon: <GraduationCap size={16} />, end: false }`
    - ה-active state מטופל אוטומטית ע"י הלוגיקה הקיימת (`startsWith("/alumni")` כולל `/alumni/:id`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 8.2 עדכן `src/router/AppRouter.tsx`
    - הוסף imports: `AlumniPage`, `AlumniCardPage` מ-`../pages/`
    - הוסף routes:
      ```tsx
      <Route path="/alumni" element={<motion.div {...pageTransition}><AlumniPage /></motion.div>} />
      <Route path="/alumni/:alumniId" element={<motion.div {...pageTransition}><AlumniCardPage /></motion.div>} />
      ```
    - עטוף את `AlumniProvider` סביב ה-app ב-`App.tsx` (או ב-`AppRouter`)
    - _Requirements: 5.2, 6.6_

- [ ] 9. DatabasePage + StudentCardPage — כפתור "יצא"
  - [ ] 9.1 הוסף ConfirmGraduateModal ל-`src/pages/DatabasePage.tsx`
    - הוסף state: `graduateTarget: Student | null`
    - הוסף עמודת "יצא" בסוף הטבלה (לפני עמודת "כרטיס"): כפתור `<GraduationCap size={14} />` שמסיים ל-`setGraduateTarget(student)`
    - הוסף `ConfirmGraduateModal` inline: מציג שם התלמיד, כפתור "אשר יציאה" וכפתור "בטל"
    - handler `handleGraduate`: קרא `graduateStudent(student.id)` → `removeLocal(id)` → הצג הודעת הצלחה; בכשל — הצג שגיאה ידידותית (כולל מקרה UNIQUE violation)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2_

  - [ ] 9.2 הוסף כפתור "יצא" ל-`src/pages/StudentCardPage.tsx`
    - הוסף כפתור "יצא" (עם `GraduationCap`) לשורת הפעולות, לצד "ערוך"
    - state `graduateConfirm: boolean` לפתיחת modal אישור
    - לאחר אישור: `graduateStudent(student.id)` → `removeLocal(student.id)` → `navigate("/database")`
    - בכשל: הצג הודעת שגיאה (כמו `saveError`)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [ ] 10. Checkpoint — וודא שהפיצ'ר שלם
  - וודא שכל הקבצים מתקמפלים (`tsc --noEmit`)
  - וודא שה-routes `/alumni` ו-`/alumni/:alumniId` עובדים
  - וודא שפעולת "יצא" מ-`DatabasePage` ומ-`StudentCardPage` מסירה תלמיד מהרשימה
  - שאל אם יש שאלות לפני סיום

---

## Notes

- משימות המסומנות ב-`*` הן אופציונליות ויכולות להידלג ל-MVP מהיר
- כל משימה מפנה לדרישות ספציפיות לצורך מעקב
- ספריית הבדיקות למאפיינים: **fast-check** (`npm install --save-dev fast-check`)
- `graduateStudent` אינה אטומית ב-DB level (Supabase JS לא חושף transactions ל-client); הסדר INSERT-לפני-DELETE מבטיח שבכשל INSERT התלמיד נשאר ב-`students`
- כל הרכיבים החדשים שומרים על `direction: rtl`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "3.2", "4.1"] },
    { "id": 3, "tasks": ["6.1", "6.2", "7.1"] },
    { "id": 4, "tasks": ["6.3", "7.2", "8.1", "8.2"] },
    { "id": 5, "tasks": ["9.1", "9.2"] }
  ]
}
```
