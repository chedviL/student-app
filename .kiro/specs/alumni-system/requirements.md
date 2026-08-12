# מסמך דרישות — מערכת בוגרים

## מבוא

מערכת הבוגרים מאפשרת לישיבת פני מנחם לנהל תלמידים שסיימו לימודיהם (יצאו) תחת רשומה נפרדת ומובחנת מטבלת התלמידים הפעילים. כאשר תלמיד "יוצא", כל פרטיו — כולל נתוני תשלומים — מועברים לטבלת `alumni` ב-Supabase, והוא מוסר מרשימת התלמידים הפעילים. לבוגרים יש דף ייעודי בממשק עם ניווט מהנאבבר, כרטיס בוגר בעיצוב כהה, ואפשרויות סינון, עריכה וייצוא מקבילות לאלה שיש ב-DatabasePage.

---

## מילון מונחים

- **System**: מערכת ניהול התלמידים (האפליקציה כולה)
- **Alumni_Module**: רכיב המערכת שמנהל את הבוגרים
- **Alumni_Table**: טבלת `alumni` ב-Supabase — מכילה את כל פרטי הבוגרים
- **Students_Table**: טבלת `students` הקיימת ב-Supabase — מכילה תלמידים פעילים בלבד
- **Alumni_Context**: ה-Context של React שמספק את רשימת הבוגרים לדפים
- **AlumniPage**: דף הבוגרים בממשק — מקביל ל-DatabasePage
- **AlumniCardPage**: כרטיס בוגר בודד — מקביל ל-StudentCardPage
- **Navbar**: סרגל הניווט העליון של האפליקציה
- **Graduate_Action**: פעולת "יצא" על תלמיד פעיל — מעבירו לטבלת הבוגרים
- **Alumni**: בוגר — תלמיד לשעבר שיצא מהישיבה
- **Student**: תלמיד פעיל הרשום בטבלת `students`

---

## דרישות

---

### דרישה 1: טבלת בוגרים ב-Supabase

**סיפור משתמש:** כמנהל הישיבה, אני רוצה שנתוני הבוגרים ישמרו בטבלה ייעודית ב-Supabase, כדי שניתן יהיה לנהל אותם בנפרד מהתלמידים הפעילים.

#### קריטריוני קבלה

1. THE Alumni_Module SHALL יצור ב-Supabase טבלת `alumni` עם כל עמודות טבלת `students` (ראה רשימה בנספח) בתוספת עמודה `graduated_at` מסוג `timestamptz` שמתועדת מתי בוצעה פעולת היציאה.
2. THE Alumni_Module SHALL יצור ב-Supabase ב-schema.sql את ה-trigger `alumni_updated_at` שמעדכן את `updated_at` לפני כל UPDATE על טבלת `alumni`, בדומה ל-trigger הקיים על `students`.
3. THE Alumni_Module SHALL יצור מדיניות Row-Level Security (RLS) על טבלת `alumni` המאפשרת `SELECT`, `INSERT`, `UPDATE` ו-`DELETE` בדומה לפוליסות הקיימות על `students`.
4. WHEN עמודת `passport_or_id` מוגדרת כ-UNIQUE ב-students_table, THEN THE Alumni_Module SHALL הגדיר גם `passport_or_id` כ-UNIQUE ב-`alumni` כדי למנוע כפילויות.

---

### דרישה 2: פעולת "יצא" על תלמיד

**סיפור משתמש:** כמנהל הישיבה, אני רוצה ללחוץ על כפתור "יצא" בכרטיס תלמיד או בשורת הטבלה, כדי להעביר את התלמיד לרשימת הבוגרים ולהסירו מרשימת התלמידים הפעילים.

#### קריטריוני קבלה

1. WHEN המשתמש לוחץ על "יצא" עבור תלמיד ב-DatabasePage, THEN THE System SHALL הציג חלון אישור שמציין את שם התלמיד ומבקש אישור לפני ביצוע הפעולה.
2. WHEN המשתמש מאשר את פעולת "יצא", THEN THE Alumni_Module SHALL העתיק את כל שדות התלמיד לטבלת `alumni` ויוסיף את `graduated_at` עם חותמת הזמן הנוכחית.
3. WHEN ההעתקה לטבלת `alumni` הצליחה, THEN THE Alumni_Module SHALL מחק את התלמיד מטבלת `students`.
4. IF ההעתקה לטבלת `alumni` נכשלה, THEN THE System SHALL יציג הודעת שגיאה ברורה ולא ימחק את התלמיד מטבלת `students` — כך שהפעולה אטומית (הכל או כלום).
5. WHEN פעולת "יצא" הושלמה בהצלחה, THEN THE System SHALL יעדכן מיידית את ה-UI — יסיר את התלמיד מרשימת התלמידים הפעילים ויציג הודעת הצלחה.
6. WHEN המשתמש לוחץ על "יצא" ב-StudentCardPage, THEN THE System SHALL יבצע את אותו תהליך כמו בדרישה 2.1–2.5 ויחזיר את המשתמש לדף הקודם לאחר הצלחה.

---

### דרישה 3: הסרת תלמידים שיצאו מרשימת התלמידים הפעילים

**סיפור משתמש:** כמנהל הישיבה, אני רוצה שתלמידים שיצאו לא יופיעו יותר בשום רשימת תלמידים פעילים, כדי שהנתונים יישארו נקיים ומדויקים.

#### קריטריוני קבלה

1. WHEN תלמיד מועבר לטבלת `alumni`, THEN THE Students_Table SHALL לא להכיל יותר שורה עם אותו `passport_or_id`.
2. WHEN DatabasePage נטען, THE System SHALL הציג רק תלמידים מטבלת `students` — ללא בוגרים.
3. WHEN SearchStudentPage מבצע חיפוש, THE System SHALL יחפש רק בתלמידים הפעילים מטבלת `students`.

---

### דרישה 4: דף בוגרים (AlumniPage)

**סיפור משתמש:** כמנהל הישיבה, אני רוצה דף ייעודי לניהול הבוגרים, כדי שאוכל לצפות, לחפש, לסנן ולערוך את פרטי הבוגרים.

#### קריטריוני קבלה

1. THE AlumniPage SHALL הציג טבלה של כל הבוגרים, עם אותן עמודות וסגנון כמו DatabasePage.
2. THE AlumniPage SHALL הציג בכותרת סטטיסטיקות: מספר סה"כ בוגרים, מספר קהילות ייחודיות, ומספר שיעורים ייחודיים.
3. WHEN המשתמש מקיש בשדה החיפוש ב-AlumniPage, THE Alumni_Module SHALL יסנן את רשימת הבוגרים לפי שם משפחה, שם פרטי, או ת"ז — בזמן אמת.
4. THE AlumniPage SHALL תמוך בסינונים: שם משפחה, שם פרטי, שיעור, קהילה, עיר — בדומה ל-DatabasePage.
5. THE AlumniPage SHALL תמוך בעריכה inline של תאי הטבלה הניתנים לעריכה, בדיוק כמו DatabasePage.
6. WHEN המשתמש לוחץ על "ייצוא" ב-AlumniPage, THE Alumni_Module SHALL ייצא את הנתונים המוצגים (לאחר סינון) לקובץ Excel בשם `בוגרים_<תאריך>.xlsx`, עם תמיכה ב-RTL.
7. THE AlumniPage SHALL הציג עמודה `graduated_at` בטבלה בפורמט `DD.MM.YYYY` כדי לאפשר למשתמש לדעת מתי הבוגר יצא.
8. WHILE AlumniPage מציג נתונים, THE Alumni_Module SHALL יקבל עדכוני Realtime מ-Supabase על שינויים בטבלת `alumni` ויעדכן את ה-UI בזמן אמת.

---

### דרישה 5: ניווט לדף הבוגרים

**סיפור משתמש:** כמנהל הישיבה, אני רוצה גישה מהירה לדף הבוגרים מהנאבבר, כדי שלא אצטרך לנווט ידנית.

#### קריטריוני קבלה

1. THE Navbar SHALL הציג קישור "בוגרים" עם אייקון מתאים, בין הקישורים הקיימים.
2. WHEN המשתמש לוחץ על "בוגרים" בנאבבר, THE System SHALL ינווט ל-`/alumni`.
3. WHEN הנאבבר מוצג בתצוגת מובייל (drawer), THE Navbar SHALL יכלול גם את קישור "בוגרים".
4. WHEN המשתמש נמצא בנתיב `/alumni` או `/alumni/:alumniId`, THE Navbar SHALL יסמן את קישור "בוגרים" כ-active.

---

### דרישה 6: כרטיס בוגר (AlumniCardPage)

**סיפור משתמש:** כמנהל הישיבה, אני רוצה לפתוח כרטיס בוגר עם כל הפרטים שלו, כדי שאוכל לראות ולערוך את המידע.

#### קריטריוני קבלה

1. THE AlumniCardPage SHALL יציג את כל פרטי הבוגר בפריסה זהה ל-StudentCardPage, עם כל השדות הקיימים.
2. THE AlumniCardPage SHALL ישתמש בעיצוב כהה יותר מ-StudentCardPage — צבעי רקע כהים לכרטיס, לסקשן ה-hero, ולגריד השדות — כדי להבדיל ויזואלית בין תלמיד פעיל לבוגר.
3. THE AlumniCardPage SHALL יציג שדה "תאריך יציאה" (graduated_at) בכותרת הכרטיס, מתחת לשם הבוגר.
4. THE AlumniCardPage SHALL תמוך בעריכה ושמירה של שדות הבוגר בדיוק כמו StudentCardPage (לא כולל עריכת graduated_at).
5. WHEN המשתמש לוחץ על כפתור "חזרה" ב-AlumniCardPage, THE System SHALL ינווט חזרה ל-`/alumni`.
6. WHEN המשתמש לוחץ על שורה ב-AlumniPage, THE System SHALL ינווט ל-`/alumni/:alumniId` תוך שימוש ב-`passport_or_id` כמזהה (בדומה ל-StudentCardPage).

---

### דרישה 7: API לבוגרים

**סיפור משתמש:** כמפתח, אני רוצה שכל הקריאות ל-Supabase עבור בוגרים יהיו מקובצות בקובץ API ייעודי, כדי שהקוד יהיה מסודר ומתוחזק.

#### קריטריוני קבלה

1. THE Alumni_Module SHALL יכיל קובץ `alumniApi.ts` תחת `src/api/` עם הפונקציות: `getAlumni`, `getAlumnusById`, `updateAlumnus`, `graduateStudent`.
2. WHEN `graduateStudent` מופעלת עם id של תלמיד, THE Alumni_Module SHALL תבצע את הפעולות בסדר: INSERT לטבלת `alumni` → DELETE מטבלת `students` — ובמקרה כשל ב-INSERT, לא תבצע DELETE.
3. THE Alumni_Module SHALL ימפה שמות עמודות בין snake_case (Supabase) ל-camelCase (TypeScript) בדיוק כמו שנעשה ב-`studentsApi.ts`, תוך שמירת אפסים מובילים במספרי טלפון.
4. THE Alumni_Module SHALL ישתמש בסוג `Alumni` שהוא `Student & { graduatedAt: string }` — מרחיב את הסוג הקיים Student.

---

## נספח: עמודות טבלת Alumni

טבלת `alumni` תכלול את כל העמודות של `students`:
`id`, `first_name`, `last_name`, `full_name`, `class_name`, `community`, `hebrew_date`, `gregorian_date`, `age`, `passport_or_id`, `father_id`, `home_phone`, `father_phone`, `mother_phone`, `father_name`, `mother_name`, `city`, `street`, `email`, `tuition`, `tuition_rank`, `due_date_note`, `payment_method`, `payment_status_notes`, `finish_241023`, `end_of_year`, `credit`, `bank_transfer`, `fax`, `contact_phone`, `contact_address`, `boarding`, `education`, `education_type`, `religion`, `religion_studies`, `siblings`, `tuition_start_date`, `created_at`, `updated_at`

בתוספת: `graduated_at timestamptz default now()`
