export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;

  className: string;
  community: string;

  hebrewDate: string;
  gregorianDate: string;
  age: string;

  passportOrId: string;
  fatherId: string;

  homePhone: string;
  fatherPhone: string;
  motherPhone: string;

  fatherName: string;
  motherName: string;

  city: string;
  street: string;
  email: string;

  tuition: string;
  tuitionRank: string;
  tuitionCurrency: string | null;
  siblings: string;
  tuitionStartDate: string | null;  // date in DB — Supabase returns YYYY-MM-DD string or null
  dueDateNote: string;
  paymentMethod: string;
  paymentStatusNotes: string;
  finish241023: string;
  endOfYear: string;
  credit: string;
  bankTransfer: string;
  fax: string;
  contactPhone: string;
  contactAddress: string;
  boarding: string;
  education?: string;
  educationType?: string;
  religion?: string;
  religionStudies?: string;
}

export type Alumni = Student & { graduatedAt: string; alumniPhone: string };