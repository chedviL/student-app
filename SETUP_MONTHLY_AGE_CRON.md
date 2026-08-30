# 📅 עדכון גיל אוטומטי - הוראות הגדרה

## סטטוס נוכחי

✅ **Migration ב-SQL**: קיימת פונקציה `process_monthly_age_update()` בבסיס הנתונים
✅ **Scripts Node.js**: קיימים scripts עבור preview ו-execute
⏳ **Cron Job**: צריך להגדיר ב-Supabase

---

## איך להגדיר Cron Job אוטומטי ב-Supabase

### שלב 1: הפעלת pg_cron extension

1. בואו ל-[Supabase Dashboard](https://supabase.com/dashboard)
2. בחר את ה-project שלך
3. עבור ל-**SQL Editor**
4. יצור query חדש והדבק:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

5. לחץ על **RUN** (קו ירוק בצד שמאל)

### שלב 2: יצירת Cron Job

אותו דבר - SQL Editor, query חדש:

```sql
SELECT cron.schedule(
  'monthly-age-update',
  '0 0 1 * *',
  'SELECT public.process_monthly_age_update();'
);
```

**הסבר:**
- `'monthly-age-update'` - שם ה-job
- `'0 0 1 * *'` - זמן ריצה: **ה-1 של כל חודש בשעה 00:00 UTC**
- `'SELECT public.process_monthly_age_update();'` - הפונקציה שתרוץ

### שלב 3: אימות (אופציונלי)

בדוק שה-job הוגדר:

```sql
SELECT * FROM cron.job;
```

הוא צריך להראות:
```
job_name: monthly-age-update
schedule: 0 0 1 * *
command: SELECT public.process_monthly_age_update();
```

---

## לבדוק את הלוגים של ה-Cron Job

```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

---

## לבדוק בהצלחה

### בדיקה אחרי ה-1 של החודש

בדוק את `monthly_age_updates` טבלה:

```sql
SELECT COUNT(*) FROM public.monthly_age_updates
WHERE update_date = CURRENT_DATE;
```

צריך להיות בעלי records עבור היום הזה (אם זה ה-1 של החודש).

---

## npm Scripts

אם אתה רוצה לבדוק או להריץ ידנית:

```bash
# בדיקה - מה יעודכן
npm run preview-age-update

# הרצה - בפועל
npm run execute-age-update
```

---

## טבלאות הקשורות

| טבלה | תיאור |
|------|-------|
| `students` | טבלת התלמידים - שדה `age` מעודכן כאן |
| `monthly_age_updates` | **Audit trail** - מי עודכן מתי ומה היה השינוי |
| `cron.job` | רשימת ה-cron jobs (ב-pg_cron) |
| `cron.job_run_details` | לוגים של כל הרצה (ב-pg_cron) |

---

## אם משהו לא עובד

### "Invalid frequency specified for schedule"
- בדוק את ה-cron pattern - צריך להיות בדיוק כך: `'0 0 1 * *'`

### "Function process_monthly_age_update does not exist"
- ודא שהרצת את `migration_fix_age_increment.sql` בבסיס הנתונים

### Cron job לא רץ
- בדוק לוגים: `SELECT * FROM cron.job_run_details WHERE job_name = 'monthly-age-update'`
- וודא שה-`success` column הוא `true`

---

## סיכום

1. ✅ SQL migration קיימת
2. 📝 צריך להריץ שתי SQL queries בחלון SQL Editor של Supabase
3. ✅ משם - כל חודש בה-1, תוצאה אוטומטית!
