import type { Alumni } from "../types/student";
import { supabase } from "../lib/supabaseClient";

function s(value: unknown): string {
  return value == null ? "" : String(value);
}

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
    alumniPhone: s(row.alumni_phone),
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
    tuitionCurrency: null,
    siblings: s(row.siblings),
    tuitionStartDate:
      row.tuition_start_date != null ? String(row.tuition_start_date) : null,
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
    graduatedAt:
      row.graduated_at != null ? String(row.graduated_at) : undefined,
  } as Alumni;
}

function mapToRow(alumni: Partial<Alumni>): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  const put = (key: string, value: unknown) => {
    if (value !== undefined) row[key] = value;
  };

  put("first_name", alumni.firstName);
  put("last_name", alumni.lastName);
  put("full_name", alumni.fullName);
  put("class_name", alumni.className);
  put("community", alumni.community);
  put("hebrew_date", alumni.hebrewDate);
  put("gregorian_date", alumni.gregorianDate);
  put("age", alumni.age);
  put("passport_or_id", alumni.passportOrId);
  put("father_id", alumni.fatherId);
  put("home_phone", alumni.homePhone);
  put("father_phone", alumni.fatherPhone);
  put("mother_phone", alumni.motherPhone);
  put("alumni_phone", alumni.alumniPhone);
  put("contact_phone", alumni.contactPhone);
  put("father_name", alumni.fatherName);
  put("mother_name", alumni.motherName);
  put("city", alumni.city);
  put("street", alumni.street);
  put("contact_address", alumni.contactAddress);
  put("email", alumni.email);
  put("fax", alumni.fax);
  put("tuition", alumni.tuition);
  put("tuition_rank", alumni.tuitionRank);
  put("siblings", alumni.siblings);
  put("tuition_start_date", alumni.tuitionStartDate);
  put("due_date_note", alumni.dueDateNote);
  put("payment_method", alumni.paymentMethod);
  put("payment_status_notes", alumni.paymentStatusNotes);
  put("finish_241023", alumni.finish241023);
  put("end_of_year", alumni.endOfYear);
  put("credit", alumni.credit);
  put("bank_transfer", alumni.bankTransfer);
  put("boarding", alumni.boarding);
  put("education", alumni.education);
  put("education_type", alumni.educationType);

  return row;
}

export async function getAlumni(): Promise<Alumni[]> {
  const { data, error } = await supabase
    .from("alumni")
    .select("*")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    mapRow(row as Record<string, unknown>)
  );
}

export async function getAlumnusById(id: string): Promise<Alumni | null> {
  const { data, error } = await supabase
    .from("alumni")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function updateAlumnus(
  id: string,
  fields: Partial<Alumni>
): Promise<Alumni> {
  const updateRow = mapToRow(fields);

  if (Object.keys(updateRow).length === 0) {
    const current = await getAlumnusById(id);
    if (!current) throw new Error("הבוגר לא נמצא");
    return current;
  }

  const { data, error } = await supabase
    .from("alumni")
    .update(updateRow)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapRow(data as Record<string, unknown>);
}

export async function graduateStudent(
  studentId: string,
  graduatedAt?: string
): Promise<Alumni> {
  const { data: studentData, error: fetchError } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .single();

  if (fetchError || !studentData) {
    throw new Error(fetchError?.message ?? "התלמיד לא נמצא");
  }

  const alumniRow = {
    id: studentData.id,
    first_name: studentData.first_name,
    last_name: studentData.last_name,
    full_name: studentData.full_name,
    class_name: studentData.class_name,
    community: studentData.community,
    hebrew_date: studentData.hebrew_date,
    gregorian_date: studentData.gregorian_date,
    age: studentData.age,
    passport_or_id: studentData.passport_or_id,
    father_id: studentData.father_id,
    home_phone: studentData.home_phone,
    father_phone: studentData.father_phone,
    mother_phone: studentData.mother_phone,
    contact_phone: studentData.contact_phone,
    father_name: studentData.father_name,
    mother_name: studentData.mother_name,
    city: studentData.city,
    street: studentData.street,
    contact_address: studentData.contact_address,
    email: studentData.email,
    fax: studentData.fax,
    tuition: studentData.tuition,
    tuition_rank: studentData.tuition_rank,
    tuition_start_date: studentData.tuition_start_date,
    siblings: studentData.siblings,
    due_date_note: studentData.due_date_note,
    payment_method: studentData.payment_method,
    payment_status_notes: studentData.payment_status_notes,
    finish_241023: studentData.finish_241023,
    end_of_year: studentData.end_of_year,
    credit: studentData.credit,
    bank_transfer: studentData.bank_transfer,
    boarding: studentData.boarding,
    education: studentData.education,
    education_type: studentData.education_type,
    graduated_at: graduatedAt
      ? new Date(graduatedAt).toISOString()
      : new Date().toISOString(),
  };

  const { data: insertedAlumni, error: insertError } = await supabase
    .from("alumni")
    .insert(alumniRow)
    .select("*")
    .single();

  if (insertError || !insertedAlumni) {
    throw new Error(
      insertError?.message ?? "שגיאה בהוספת הבוגר לטבלת alumni"
    );
  }

  const { error: deleteError } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId);

  if (deleteError) {
    throw new Error(
      `הבוגר נוסף לטבלת alumni, אבל מחיקת התלמיד נכשלה: ${deleteError.message}`
    );
  }

  return mapRow(insertedAlumni as Record<string, unknown>);
}