# הגדרת עוזר ה-AI

הפרויקט כולל כעת מסך **עוזר AI** שמחובר ל-Supabase באמצעות Edge Function מאובטחת.

## מה העוזר יודע לעשות כרגע

- לחפש תלמיד פעיל לפי שם או מספר זהות/דרכון.
- להחזיר שם, שיעור, קהילה ועיר.
- לקרוא את יתרת שכר הלימוד העדכנית מתוך `tuition_balances`.
- לענות כמה תלמיד חייב, מה היתרה שלו ובאיזה מטבע.
- להחזיר סיכום כולל של מספר החייבים וסכומי החוב בשקלים ובדולרים.
- להבין שאלות המשך בשיחה קצרה.

המודל **לא מקבל SQL חופשי** ולא יכול לשנות נתונים. הוא יכול להפעיל רק כלים לקריאה שהוגדרו מראש ב-Edge Function.

## התקנה מהירה ב-Windows

פתחי PowerShell בשורש הפרויקט והריצי:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-ai-assistant.ps1
```

הסקריפט:

1. מזהה את Supabase Project Ref מתוך `.env` אם אפשר.
2. מבצע Login ו-Link דרך Supabase CLI.
3. מבקש את `OPENAI_API_KEY` בצורה מוסתרת ושומר אותו כ-Edge Function secret — לא ב-React.
4. מעלה את הפונקציה `ai-assistant` ל-Supabase.

לאחר מכן מריצים את האתר כרגיל:

```powershell
npm run dev
```

## אבטחה

- `OPENAI_API_KEY` נשמר רק ב-Supabase Secrets.
- הדפדפן שולח ל-Edge Function את ה-session של המשתמש המחובר.
- הפונקציה מאמתת את המשתמש ומבצעת שאילתות עם ה-JWT שלו, ולכן RLS של Supabase נשאר פעיל.
- הכלים הם read-only ואינם מאפשרים INSERT/UPDATE/DELETE.
- לשירות OpenAI נשלחים רק השאלה והנתונים המינימליים שנדרשו לצורך התשובה.

## קבצים שנוספו


- `src/pages/AIAssistantPage.tsx`
- `src/pages/AIAssistantPage.css`
- `src/api/aiApi.ts`
- `supabase/functions/ai-assistant/index.ts`
- `supabase/config.toml`
- `scripts/setup-ai-assistant.ps1`
