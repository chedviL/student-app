-- ============================
-- טבלת בוגרים
-- להריץ ב-Supabase SQL Editor
-- ============================

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

  -- מסמכים — passport_or_id הוא המזהה הייחודי של הבוגר
  passport_or_id text unique,
  father_id text,

  -- טלפונים
  home_phone text,
  father_phone text,
  mother_phone text,
  -- טלפון ייחודי לבוגר
  alumni_phone text,

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

  -- מטא
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- תאריך יציאה
  graduated_at timestamptz default now()
);

-- עדכון אוטומטי של updated_at
create trigger alumni_updated_at
  before update on alumni
  for each row execute function update_updated_at();

-- ============================
-- Row Level Security
-- ============================

alter table alumni enable row level security;

-- קריאה — כל משתמש מחובר יכול לקרוא
create policy "allow read"
  on alumni
  for select
  using (auth.role() = 'authenticated');

-- כתיבה — כל משתמש מחובר יכול להוסיף
create policy "allow insert"
  on alumni
  for insert
  with check (auth.role() = 'authenticated');

-- עדכון — כל משתמש מחובר יכול לעדכן
create policy "allow update"
  on alumni
  for update
  using (auth.role() = 'authenticated');

-- מחיקה — כל משתמש מחובר יכול למחוק
create policy "allow delete"
  on alumni
  for delete
  using (auth.role() = 'authenticated');
