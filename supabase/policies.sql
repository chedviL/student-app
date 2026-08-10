-- ============================
-- הרשאות גישה לטבלת תלמידים
-- להריץ ב-Supabase SQL Editor
-- ============================

-- קריאה — כל משתמש מחובר יכול לקרוא
create policy "allow read"
  on students
  for select
  using (auth.role() = 'authenticated');

-- כתיבה — כל משתמש מחובר יכול להוסיף
create policy "allow insert"
  on students
  for insert
  with check (auth.role() = 'authenticated');

-- עדכון — כל משתמש מחובר יכול לעדכן
create policy "allow update"
  on students
  for update
  using (auth.role() = 'authenticated');

-- מחיקה — כל משתמש מחובר יכול למחוק
create policy "allow delete"
  on students
  for delete
  using (auth.role() = 'authenticated');
