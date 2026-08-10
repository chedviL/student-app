import type { Student } from "../types/student";
import { supabase } from "../lib/supabaseClient";

// ממפה שמות עמודות מ-Supabase (snake_case) לממשק TypeScript (camelCase)
function mapRow(row: Record<string, unknown>): Student {
  return {
    id: String(row.id ?? ""),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: String(row.full_name ?? ""),
    className: String(row.class_name ?? ""),
    community: String(row.community ?? ""),
    hebrewDate: String(row.hebrew_date ?? ""),
    gregorianDate: String(row.gregorian_date ?? ""),
    age: String(row.age ?? ""),
    passportOrId: String(row.passport_or_id ?? ""),
    fatherId: String(row.father_id ?? ""),
    homePhone: String(row.home_phone ?? ""),
    fatherPhone: String(row.father_phone ?? ""),
    motherPhone: String(row.mother_phone ?? ""),
    contactPhone: String(row.contact_phone ?? ""),
    fatherName: String(row.father_name ?? ""),
    motherName: String(row.mother_name ?? ""),
    city: String(row.city ?? ""),
    street: String(row.street ?? ""),
    contactAddress: String(row.contact_address ?? ""),
    email: String(row.email ?? ""),
    fax: String(row.fax ?? ""),
    tuition: String(row.tuition ?? ""),
    tuitionRank: String(row.tuition_rank ?? ""),
    dueDateNote: String(row.due_date_note ?? ""),
    paymentMethod: String(row.payment_method ?? ""),
    paymentStatusNotes: String(row.payment_status_notes ?? ""),
    finish241023: String(row.finish_241023 ?? ""),
    endOfYear: String(row.end_of_year ?? ""),
    credit: String(row.credit ?? ""),
    bankTransfer: String(row.bank_transfer ?? ""),
    boarding: String(row.boarding ?? ""),
    education: String(row.education ?? ""),
    educationType: String(row.education_type ?? ""),
    religion: String(row.religion ?? ""),
    religionStudies: String(row.religion_studies ?? ""),
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
