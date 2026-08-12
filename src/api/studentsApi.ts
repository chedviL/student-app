import type { Student } from "../types/student";
import { supabase } from "../lib/supabaseClient";

// ממפה שמות עמודות מ-Supabase (snake_case) לממשק TypeScript (camelCase)

// מחרוזת בטוחה — שומר אפסים מובילים (חשוב למספרי טלפון)
function s(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
}

function mapRow(row: Record<string, unknown>): Student {
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
    tuitionCurrency: row.tuition_currency ? String(row.tuition_currency) : null,
    // tuition_start_date is type date in DB — Supabase returns YYYY-MM-DD string or null
    tuitionStartDate: row.tuition_start_date ? String(row.tuition_start_date) : null,
    siblings: s(row.siblings),
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
  };
}

// ממפה מ-TypeScript (camelCase) חזרה ל-Supabase (snake_case)
function mapToRow(student: Partial<Student>): Record<string, unknown> {
  return {
    first_name: student.firstName,
    last_name: student.lastName,
    full_name: student.fullName,
    class_name: student.className,
    community: student.community,
    hebrew_date: student.hebrewDate,
    gregorian_date: student.gregorianDate,
    age: student.age,
    passport_or_id: student.passportOrId,
    father_id: student.fatherId,
    home_phone: student.homePhone,
    father_phone: student.fatherPhone,
    mother_phone: student.motherPhone,
    contact_phone: student.contactPhone,
    father_name: student.fatherName,
    mother_name: student.motherName,
    city: student.city,
    street: student.street,
    contact_address: student.contactAddress,
    email: student.email,
    fax: student.fax,
    tuition: student.tuition,
    tuition_rank: student.tuitionRank,
    tuition_currency: student.tuitionCurrency,
    // send YYYY-MM-DD string or null — Postgres date column accepts ISO strings
    tuition_start_date: student.tuitionStartDate ?? null,
    due_date_note: student.dueDateNote,
    payment_method: student.paymentMethod,
    payment_status_notes: student.paymentStatusNotes,
    finish_241023: student.finish241023,
    end_of_year: student.endOfYear,
    credit: student.credit,
    bank_transfer: student.bankTransfer,
    boarding: student.boarding,
    education: student.education,
    education_type: student.educationType,
    religion: student.religion,
    religion_studies: student.religionStudies,
  };
}

// קריאת כל התלמידים
export async function getStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

// קריאת תלמיד לפי ID
export async function getStudentById(id: string): Promise<Student | null> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return mapRow(data);
}

// הוספת תלמיד חדש
export async function createStudent(student: Omit<Student, "id">): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .insert(mapToRow(student))
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

// עדכון תלמיד קיים
export async function updateStudent(id: string, student: Partial<Student>): Promise<Student> {
  const { data, error } = await supabase
    .from("students")
    .update(mapToRow(student))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

// מחיקת תלמיד
export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// פונקציה ריקה לתאימות לאחור (לא נדרשת יותר עם Supabase)
export function clearStudentsCache() {}
