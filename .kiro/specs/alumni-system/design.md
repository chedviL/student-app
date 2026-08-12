# עיצוב טכני — מערכת בוגרים

## Overview

מערכת הבוגרים מוסיפה לאפליקציה ניהול תלמידים של ישיבת פני מנחם שכבה שנייה: ניהול בוגרים (alumni). כאשר תלמיד "יוצא", פרטיו מועברים אטומית מטבלת `students` לטבלת `alumni` ב-Supabase. הממשק מקבל דף ייעודי לבוגרים עם כרטיס בוגר, Realtime, סינון, עריכה inline וייצוא Excel — כולם מקבילים לרכיבים הקיימים.

### עקרונות עיצוב מנחים

1. **מינימום שינויים לקוד קיים** — כל הלוגיקה החדשה בקבצים חדשים; שינויים בקבצים קיימים מצומצמים וברורים.
2. **עקביות מוחלטת** — `alumniApi.ts`, `AlumniContext`, `AlumniPage` ו-`AlumniCardPage` כולם מחקים את המבנה של עמיתיהם הקיימים.
3. **אטומיות פעולת "יצא"** — INSERT ל-`alumni` לפני DELETE מ-`students`; אם INSERT נכשל, DELETE לא מתבצע.
4. **עיצוב RTL** — כל הרכיבים החדשים שומרים על `direction: rtl` ועל פלטת הצבעים הקיימת.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Supabase                                               │
│  ┌──────────────┐      ┌──────────────────────────────┐ │
│  │  students    │      │  alumni                      │ │
│  │  (פעילים)    │ ─ → │  (כל עמודות students         │ │
│  │              │      │   + graduated_at timestamptz)│ │
│  └──────────────┘      └──────────────────────────────┘ │
│        ↕ Realtime                  ↕ Realtime           │
└─────────────────────────────────────────────────────────┘
          │                                │
  StudentsContext                   AlumniContext
  (קיים + removeLocal)             (חדש, מבנה זהה)
          │                                │
  DatabasePage ──────────┐   AlumniPage (חדש)
  StudentCardPage ───────┤   AlumniCardPage (חדש)
                  Graduate│
                  Action  │
  alumniApi.ts ──────────┘
  (graduateStudent: INSERT → DELETE)
```

### זרימת פעולת "יצא"

```
משתמש לוחץ "יצא"
       ↓
חלון אישור (שם התלמיד)
       ↓ מאשר
graduateStudent(studentId)
  1. INSERT INTO alumni ← כל שדות התלמיד + graduated_at = now()
  2. אם INSERT הצליח → DELETE FROM students WHERE id = studentId
  3. אם INSERT נכשל  → throw error (ללא DELETE)
       ↓ הצלחה
removeLocal(id) בStudentsContext   ← עדכון מיידי ב-UI
       ↓
Realtime DELETE event (גיבוי כפול)
```

---

## Components and Interfaces

### קבצים חדשים

| קובץ | תיאור |
|------|-------|
| `supabase/alumni_schema.sql` | DDL טבלת alumni + trigger + RLS |
| `src/types/student.ts` | הוספת `Alumni` type |
| `src/api/alumniApi.ts` | getAlumni, getAlumnusById, updateAlumnus, graduateStudent |
| `src/context/AlumniContext.tsx` | Provider + hook, Realtime על alumni |
| `src/pages/AlumniPage.tsx` | דף בוגרים (מקביל ל-DatabasePage) |
| `src/pages/AlumniPage.css` | עיצוב דף בוגרים |
| `src/pages/AlumniCardPage.tsx` | כרטיס בוגר (מקביל ל-StudentCardPage) |

### קבצים מעודכנים

| קובץ | שינוי |
|------|-------|
| `src/types/student.ts` | `export type Alumni = Student & { graduatedAt: string }` |
| `src/context/StudentsContext.tsx` | `removeLocal(id: string)` ב-interface ובפונקציה |
| `src/components/common/Navbar.tsx` | הוספת `GraduationCap` לרשימת NAV_ITEMS |
| `src/router/AppRouter.tsx` | routes `/alumni` ו-`/alumni/:alumniId` |
| `src/pages/DatabasePage.tsx` | עמודת "יצא" + חלון אישור |
| `src/pages/StudentCardPage.tsx` | כפתור "יצא" + חלון אישור + navigate(-1) לאחר הצלחה |

---

## Data Models

### טבלת `alumni` ב-Supabase

```sql
create table alumni (
  id uuid primary key default gen_random_uuid(),

  -- שם
  first_name text,
  last_name text,
  full_name text,

  -- שיעור וקהילה
  class_name text,
  community text,

  -- תאריכים וגיל
  hebrew_date text,
  gregorian_date text,
  age text,

  -- מסמכים
  passport_or_id text unique,
  father_id text,

  -- טלפונים
  home_phone text,
  father_phone text,
  mother_phone text,

  -- הורים
  father_name text,
  mother_name text,

  -- כתובת
  city text,
  street text,

  -- דיגיטלי
  email text,

  -- שכר לימוד
  tuition text,
  tuition_rank text,
  siblings text,
  tuition_start_date text,

  -- תשלומים
  due_date_note text,
  payment_method text,
  payment_status_notes text,
  finish_241023 text,
  end_of_year text,
  credit text,
  bank_transfer text,
  fax text,

  -- איש קשר
  contact_phone text,
  contact_address text,

  -- פנימייה
  boarding text,

  -- חינוך
  education text,
  education_type text,
  religion text,
  religion_studies text,

  -- מטא
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- ייחודי לבוגרים
  graduated_at timestamptz default now()
);

-- trigger לעדכון updated_at (שימוש בפונקציה הקיימת update_updated_at())
create trigger alumni_updated_at
  before update on alumni
  for each row execute function update_updated_at();
```

### TypeScript types

```typescript
// src/types/student.ts — הוספה לסוף הקובץ הקיים

export type Alumni = Student & {
  graduatedAt: string; // ISO timestamp מ-graduated_at
};
```

### AlumniContext interface

```typescript
interface AlumniState {
  alumni: Alumni[];
  loading: boolean;
  error: string;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  updateLocal: (updated: Alumni) => void;
}
```

### StudentsContext interface — שינוי

```typescript
// הוספה לממשק הקיים StudentsState
removeLocal: (id: string) => void;
```

---

## מדיניות Row-Level Security

```sql
-- alumni — זהה לפוליסות students
alter table alumni enable row level security;

create policy "alumni allow read"
  on alumni for select
  using (auth.role() = 'authenticated');

create policy "alumni allow insert"
  on alumni for insert
  with check (auth.role() = 'authenticated');

create policy "alumni allow update"
  on alumni for update
  using (auth.role() = 'authenticated');

create policy "alumni allow delete"
  on alumni for delete
  using (auth.role() = 'authenticated');
```

---

## alumniApi.ts — פירוט פונקציות

### `graduateStudent(studentId: string): Promise<Alumni>`

```
1. שלוף את נתוני התלמיד מ-students WHERE id = studentId
2. INSERT INTO alumni ← כל שדותיו + graduated_at = now()
   (Supabase מחזיר את השורה שנוצרה)
3. אם INSERT נכשל → throw Error (ללא שלב 4)
4. DELETE FROM students WHERE id = studentId
5. אם DELETE נכשל → throw Error (הרשומה ב-alumni כבר קיימת — מצב קצה)
6. return Alumni שנוצר
```

> הערה על אטומיות: Supabase אינו חושף transactions ל-client-side JS ישירות. הסדר INSERT-לפני-DELETE מבטיח שבמקרה כשל ב-INSERT, התלמיד נשאר ב-students. כשל ב-DELETE לאחר INSERT מוביל לכפילות (קצה נדיר) — ניתן לטפל בכך בעתיד עם Database Function/RPC ב-Supabase.

### `getAlumni(): Promise<Alumni[]>`

מחזיר את כל הבוגרים מסודרים לפי `last_name`.

### `getAlumnusById(id: string): Promise<Alumni | null>`

מחזיר בוגר לפי uuid.

### `updateAlumnus(id: string, data: Partial<Alumni>): Promise<Alumni>`

עדכון שדות בוגר, זהה ל-`updateStudent`.

### מיפוי snake_case ↔ camelCase

```
graduated_at  ↔  graduatedAt
```
שאר השדות — זהה לחלוטין ל-`studentsApi.ts`.

---

## AlumniPage — פירוט רכיב

### עמודות טבלה

עמודות זהות ל-`COLUMNS` ב-DatabasePage + עמודת `graduated_at`:

```typescript
const ALUMNI_COLUMNS: ColDef[] = [
  ...COLUMNS, // כל העמודות הקיימות
  { key: "graduatedAt", label: "תאריך יציאה", width: 120 }, // read-only
];
```

### סטטיסטיקות בכותרת

- סה"כ בוגרים
- קהילות ייחודיות
- שיעורים ייחודיים

### ייצוא Excel

שם קובץ: `בוגרים_DD-MM-YYYY.xlsx` — כולל עמודת `graduated_at`.

---

## AlumniCardPage — פירוט עיצוב כהה

```css
/* צבעי רקע כהים לאבחנה ויזואלית */
--alumni-card-bg:    #1e1e2e;
--alumni-hero-bg:    #2d2d44;
--alumni-grid-bg:    #252538;
--alumni-text:       #e0deff;
--alumni-text-soft:  #9999cc;
--alumni-accent:     #7c6fcd;
--alumni-border:     rgba(124, 111, 205, 0.25);
```

### שדה "תאריך יציאה" בכותרת

מוצג מתחת לשם הבוגר בפורמט `DD.MM.YYYY`, ולא ניתן לעריכה.

### ניווט לאחר "חזרה"

`navigate("/alumni")` (ישיר, לא `-1`) לבטיחות.

---

## DatabasePage — שינויים

### עמודת "יצא"

```tsx
// עמודה נוספת בסוף הטבלה, לפני עמודת "כרטיס"
<td className="db-td-link">
  <button
    className="db-graduate-btn"
    onClick={() => setGraduateTarget(student)}
    title="יצא תלמיד"
  >
    <GraduationCap size={14} />
  </button>
</td>
```

### חלון אישור

```tsx
{graduateTarget && (
  <ConfirmGraduateModal
    student={graduateTarget}
    onConfirm={() => handleGraduate(graduateTarget)}
    onCancel={() => setGraduateTarget(null)}
  />
)}
```

Modal מוצג עם שם התלמיד, כפתור "אשר יציאה" וכפתור "בטל".

---

## StudentCardPage — שינויים

כפתור "יצא" בשורת הפעולות, לצד "ערוך". לחיצה → `ConfirmGraduateModal` → `graduateStudent` → `removeLocal` → `navigate("/database")`.

---

## Error Handling

| מצב | טיפול |
|-----|-------|
| INSERT ל-alumni נכשל | הצגת הודעת שגיאה; התלמיד נשאר ב-students |
| DELETE מ-students נכשל לאחר INSERT | הצגת הודעת שגיאה עם אזהרה על כפילות אפשרית |
| `getAlumni` נכשל | AlumniPage מציג הודעת שגיאה (כמו DatabasePage) |
| `updateAlumnus` נכשל | AlumniCardPage מציג הודעת שגיאה (כמו StudentCardPage) |
| שגיאת רשת ב-Realtime | החזרת ערכי lastUpdated ישנים; לא קריסה |
| מנסים "לסיים" תלמיד שכבר בוגר | Supabase מחזיר שגיאת UNIQUE על `passport_or_id` → הצגת הודעה ידידותית |

---

## Testing Strategy

### גישה כפולה: Unit Tests + Property-Based Tests

#### בדיקות יחידה (Unit Tests — דוגמאות ספציפיות)

- `graduateStudent` עם mock Supabase: בדיקה עם תלמיד ספציפי שהמיפוי נכון ו-DELETE נקרא.
- `removeLocal` מחזיר array ריק כשמסירים את האלמנט האחרון.
- `fmtDate("2024-01-15")` → `"15.01.2024"`.
- `fmtDate(undefined)` → `""`.
- `fmtDate("15.01.2024")` → `"15.01.2024"` (unchanged).
- AlumniPage מציג "0 בוגרים" עם רשימה ריקה.
- Navbar מכיל קישור "בוגרים" לאחר העדכון.

#### בדיקות מבוססות מאפיינים (Property-Based Tests)

ספריה מומלצת: **fast-check** (TypeScript/JavaScript).

כל property test רץ במינימום **100 iterations**.

```
תגית פורמט: Feature: alumni-system, Property {מספר}: {כותרת}
```

**Property 1 — שמירת שדות בפעולת "יצא"**
```
Feature: alumni-system, Property 1: field preservation on graduate
```
- Generator: `fc.record({ firstName, lastName, passportOrId, ... })`
- Action: mock Supabase INSERT, קרא `graduateStudent`
- Assert: הערכים שהועברו ל-INSERT שווים לשדות המקוריים; `graduated_at` לא null

**Property 2 — אטומיות INSERT לפני DELETE**
```
Feature: alumni-system, Property 2: atomicity insert before delete
```
- Generator: שגיאות INSERT רנדומליות (שגיאות שונות)
- Action: mock Supabase INSERT ל-reject, קרא `graduateStudent`
- Assert: DELETE לא נקרא לעולם כשINSERT נכשל

**Property 3 — הסרה מ-UI**
```
Feature: alumni-system, Property 3: removeLocal removes exactly one
```
- Generator: `fc.array(studentRecord)` + בחירת id אקראי מהמערך
- Action: `removeLocal(id)`
- Assert: `alumni.find(a => a.id === id)` === undefined; שאר המערך שלם

**Property 4 — round-trip מיפוי**
```
Feature: alumni-system, Property 4: snake_case camelCase round-trip
```
- Generator: `fc.record(...)` עם שדות Alumni כולל מחרוזות עם אפסים מובילים
- Action: `mapRow(mapToRow(alumni))`
- Assert: כל שדה שמרוּ (השוואה string-by-string)

**Property 5 — סינון בוגרים**
```
Feature: alumni-system, Property 5: filter results always match query
```
- Generator: `fc.array(alumniRecord)`, `fc.string()`
- Action: פונקציית הסינון
- Assert: לכל תוצאה: `lastName.includes(q) || firstName.includes(q) || passportOrId.includes(q)`

**Property 6 — עיצוב תאריך**
```
Feature: alumni-system, Property 6: fmtDate always returns DD.MM.YYYY
```
- Generator: timestamps תקינים בפורמטים שונים
- Action: `fmtDate(ts)`
- Assert: מתאים ל-regex `/^\d{2}\.\d{2}\.\d{4}$/`

#### בדיקות אינטגרציה (Integration Tests)

- `graduateStudent` end-to-end מול Supabase test DB (1-2 דוגמאות): תלמיד מופיע ב-alumni ולא ב-students.
- Realtime: לאחר `graduateStudent`, ה-DELETE event מ-Supabase מסיר את התלמיד מ-StudentsContext (1 דוגמה).
- Supabase RLS: קריאה ללא auth מחזירה 401 על שתי הטבלאות (1 דוגמה).

---

## Correctness Properties

*מאפיין הוא תכונה או התנהגות שצריכה להתקיים בכל הרצה תקינה של המערכת — למעשה, הצהרה פורמלית על מה שהמערכת אמורה לעשות. מאפיינים משמשים כגשר בין מפרטים קריאים לאדם לבין ערבויות נכונות הניתנות לאימות אוטומטי.*

---

### Property 1: שמירת שדות בפעולת "יצא"

*לכל* תלמיד עם ערכי שדות שרירותיים, לאחר קריאה ל-`graduateStudent`, השורה שנוצרת בטבלת `alumni` חייבת להכיל ערכים שווים בכל שדה של אותו תלמיד, ועמודת `graduated_at` חייבת להיות timestamp לא-ריק.

**Validates: Requirements 2.2, 7.2**

---

### Property 2: אטומיות — INSERT לפני DELETE

*לכל* ניסיון graduation, אם הקריאה ל-INSERT לטבלת `alumni` נכשלת (בכל סיבה שהיא), פונקציית `graduateStudent` לא תקרא ל-DELETE מטבלת `students` — ה-id של התלמיד לא יועבר לפונקציית המחיקה.

**Validates: Requirements 2.4, 7.2**

---

### Property 3: הסרה מ-UI לאחר graduation

*לכל* state של StudentsContext המכיל תלמיד עם id נתון, לאחר קריאה ל-`removeLocal(id)`, מערך `students` לא יכיל יותר אף רשומה עם אותו id.

**Validates: Requirements 2.5, 3.1**

---

### Property 4: round-trip מיפוי snake_case ↔ camelCase

*לכל* אובייקט `Alumni` עם שדות שרירותיים (כולל מחרוזות עם אפסים מובילים, ערכים ריקים, תווים בעברית ובאנגלית), ביצוע `mapRow(mapToRow(alumni))` חייב להחזיר ערכים שווים לאובייקט המקורי בכל שדה ניתן-למיפוי.

**Validates: Requirements 7.3**

---

### Property 5: סינון בוגרים — כל תוצאה מכילה את ה-query

*לכל* רשימת בוגרים שרירותית ו-query חיפוש שרירותי (לא ריק), כל בוגר שמוחזר לאחר הסינון חייב להכיל את ה-query באחד מהשדות: `lastName`, `firstName`, או `passportOrId` (השוואה case-insensitive).

**Validates: Requirements 4.3, 4.4**

---

### Property 6: עיצוב תאריך — פלט בפורמט DD.MM.YYYY

*לכל* ערך timestamp תקין (ISO 8601, Excel serial, DD.MM.YYYY), פונקציית `fmtDate` חייבת להחזיר מחרוזת בפורמט `DD.MM.YYYY` — שני ספרות ליום, שני ספרות לחודש, ארבע ספרות לשנה, מופרדות בנקודות.

**Validates: Requirements 4.7**

