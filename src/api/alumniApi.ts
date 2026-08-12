import type { Alumni } from "../types/student";
import { supabase } from "../lib/supabaseClient";

// מחרוזת בטוחה — שומר אפסים מובילים (חשוב למספרי טלפון)
function s(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

// ממפה שמות עמודות מ-Supabase (snake_case) לממשק TypeScript (camelCase)
function mapRow(row: Record<string, unknown>): Alumni {
  return {
    id: s(row.id),
    firstName: s(row.first_name),
    lastName: s(row.last_name),
    fullName: s(row.full_name),
    className: s(row.class_name),
    community: s(row.community),
    hebrewDate: s(row.hebrew_date),
    gregorianDate: s(row.gregorian_date),
    age: s(row.age),
    passportOrId: s(row.passport_or_id),
    fatherId: s(row.father_id),
    homePhone: s(row.home_phone),
    fatherPhone: s(row.father_phone),
    motherPhone: s(row.mother_phone),
    contactPhone: s(row.contact_phone),
    fatherName: s(row.father_name),
    motherName: s(row.mother_name),
    city: s(row.city),
    street: s(row.street),
    contactAddress: s(row.contact_address),
    email: s(row.email),
    fax: s(row.fax),
    tuition: s(row.tuition),
    tuitionRank: s(row.tuition_rank),
    tuitionCurrency: row.tuition_currency != null ? String(row.tuition_currency) : null,
    siblings: s(row.siblings),
    tuitionStartDate: row.tuition_start_date != null ? String(row.tuition_start_date) : null,
    dueDateNote: s(row.due_date_note),
    paymentMethod: s(row.payment_method),
    paymentStatusNotes: s(row.payment_status_notes),
    finish241023: s(row.finish_241023),
    endOfYear: s(row.end_of_year),
    credit: s(row.credit),
    bankTransfer: s(row.bank_transfer),
    boarding: s(row.boarding),
    education: s(row.education),
    educationType: s(row.education_type),
    religion: s(row.religion),
    religionStudies: s(row.religion_studies),
    alumniPhone: s(row.alumni_phone),
    // שדה ייחודי לבוגרים
    graduatedAt: s(row.graduated_at),
  };
}

// ממפה מ-TypeScript (camelCase) חזרה ל-Supabase (snake_case)
// ללא graduated_at — שדה read-only שנקבע בעת הוספה בלבד
function mapToRow(alumni: Partial<Alumni>): Record<string, unknown> {
  return {
    first_name: alumni.firstName,
    last_name: alumni.lastName,
    full_name: alumni.fullName,
    class_name: alumni.className,
    community: alumni.community,
    hebrew_date: alumni.hebrewDate,
    gregorian_date: alumni.gregorianDate,
    age: alumni.age,
    passport_or_id: alumni.passportOrId,
    father_id: alumni.fatherId,
    home_phone: alumni.homePhone,
    father_phone: alumni.fatherPhone,
    mother_phone: alumni.motherPhone,
    contact_phone: alumni.contactPhone,
    father_name: alumni.fatherName,
    mother_name: alumni.motherName,
    city: alumni.city,
    street: alumni.street,
    contact_address: alumni.contactAddress,
    email: alumni.email,
    fax: alumni.fax,
    tuition: alumni.tuition,
    tuition_rank: alumni.tuitionRank,
    siblings: alumni.siblings,
    tuition_start_date: alumni.tuitionStartDate,
    due_date_note: alumni.dueDateNote,
    payment_method: alumni.paymentMethod,
    payment_status_notes: alumni.paymentStatusNotes,
    finish_241023: alumni.finish241023,
    end_of_year: alumni.endOfYear,
    credit: alumni.credit,
    bank_transfer: alumni.bankTransfer,
    boarding: alumni.boarding,
    education: alumni.education,
    education_type: alumni.educationType,
    religion: alumni.religion,
    religion_studies: alumni.religionStudies,
    alumni_phone: alumni.alumniPhone,
  };
}

// קריאת כל הבוגרים
export async function getAlumni(): Promise<Alumni[]> {
  const { data, error } = await supabase
    .from("alumni")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

// קריאת בוגר לפי ID
export async function getAlumnusById(id: string): Promise<Alumni | null> {
  const { data, error } = await supabase
    .from("alumni")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return mapRow(data);
}

// עדכון בוגר קיים
export async function updateAlumnus(id: string, data: Partial<Alumni>): Promise<Alumni> {
  const { data: updated, error } = await supabase
    .from("alumni")
    .update(mapToRow(data))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRow(updated);
}

// הוצאת תלמיד לבוגרים:
// 1. שליפת נתוני התלמיד מ-students
// 2. INSERT INTO alumni (כל שדות + graduated_at)
// 3. אם INSERT הצליח — DELETE FROM students
// 4. החזרת רשומת הבוגר שנוצרה
export async function graduateStudent(studentId: string, graduatedAt?: string): Promise<Alumni> {
  // שלב 1: שליפת התלמיד
  const { data: studentData, error: fetchError } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();

  if (fetchError || !studentData) {
    throw new Error("תלמיד לא נמצא");
  }

  // שלב 2: בניית שורת alumni עם רק העמודות שקיימות בטבלת alumni
  // (religion, religion_studies, tuition_currency אינן קיימות ב-alumni)
  const alumniRow = {
    id:                   studentData.id,
    first_name:           studentData.first_name,
    last_name:            studentData.last_name,
    full_name:            studentData.full_name,
    class_name:           studentData.class_name,
    community:            studentData.community,
    hebrew_date:          studentData.hebrew_date,
    gregorian_date:       studentData.gregorian_date,
    age:                  studentData.age,
    passport_or_id:       studentData.passport_or_id,
    father_id:            studentData.father_id,
    home_phone:           studentData.home_phone,
    father_phone:         studentData.father_phone,
    mother_phone:         studentData.mother_phone,
    contact_phone:        studentData.contact_phone,
    father_name:          studentData.father_name,
    mother_name:          studentData.mother_name,
    city:                 studentData.city,
    street:               studentData.street,
    contact_address:      studentData.contact_address,
    email:                studentData.email,
    fax:                  studentData.fax,
    tuition:              studentData.tuition,
    tuition_rank:         studentData.tuition_rank,
    tuition_start_date:   studentData.tuition_start_date,
    siblings:             studentData.siblings,
    due_date_note:        studentData.due_date_note,
    payment_method:       studentData.payment_method,
    payment_status_notes: studentData.payment_status_notes,
    finish_241023:        studentData.finish_241023,
    end_of_year:          studentData.end_of_year,
    credit:               studentData.credit,
    bank_transfer:        studentData.bank_transfer,
    boarding:             studentData.boarding,
    education:            studentData.education,
    education_type:       studentData.education_type,
    graduated_at: graduatedAt ? new Date(graduatedAt).toISOString() : new Date().toISOString(),
  };

  const { data: insertedAlumni, error: insertError } = await supabase
    .from("alumni")
    .insert(alumniRow)
    .select()
    .single();

  // שלב 3: אם INSERT נכשל — לא מוחקים, זורקים שגיאה (התלמיד נשאר ב-students)
  if (insertError || !insertedAlumni) {
    throw new Error(
      insertError?.message ?? "שגיאה בהוספת הבוגר לטבלת alumni"
    );
  }

  // שלב 4: DELETE FROM students — רק לאחר INSERT מוצלח
  const { error: deleteError } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (deleteError) {
    throw new Error(
      `הבוגר נוסף לטבלת alumni אך מחיקת התלמיד מ-students נכשלה: ${deleteError.message}. ` +
        `יש למחוק ידנית את התלמיד עם id=${studentId} כדי למנוע כפילות.`
    );
  }

  // שלב 5: החזרת רשומת הבוגר
  return mapRow(insertedAlumni);
}
