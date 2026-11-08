import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Student } from "../types/student";
import { getStudents } from "../api/studentsApi";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentsState {
  students: Student[];
  loading: boolean;
  error: string;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  updateLocal: (updated: Student) => void;
  removeLocal: (id: string) => void;
  addLocal: (student: Student) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StudentsContext = createContext<StudentsState | null>(null);

// ─── Helper: map a raw Supabase realtime row → Student ───────────────────────

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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StudentsProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Data is loaded per logged-in user. Loading once at mount (before login) only
  // worked while the table was readable anonymously; with RLS it returns nothing.
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // The user whose data this provider currently holds, and a sequence number for
  // load requests. A response is applied only if it belongs to the LATEST request
  // and that user is still logged in — a slow response started before a logout or
  // an account switch can never repopulate another session's data.
  const activeUserRef = useRef<string | null>(null);
  const requestSeqRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestUser = activeUserRef.current;
    if (!requestUser) return;                      // never query without a session
    const seq = ++requestSeqRef.current;
    const isCurrent = () =>
      requestSeqRef.current === seq && activeUserRef.current === requestUser;
    try {
      setLoading(true);
      setError("");
      const data = await getStudents();
      if (!isCurrent()) return;                    // stale: user changed / newer request
      setStudents(data);
      setLastUpdated(new Date());
    } catch (err) {
      if (!isCurrent()) return;
      setError(err instanceof Error ? err.message : "שגיאה בטעינת נתונים");
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  // עדכון מיידי של תלמיד אחד ב-state (ללא המתנה ל-Realtime)
  const updateLocal = useCallback((updated: Student) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
    setLastUpdated(new Date());
  }, []);

  // הסרה מיידית של תלמיד מה-state (לאחר פעולת "יצא")
  const removeLocal = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setLastUpdated(new Date());
  }, []);

  // הוספה מיידית של תלמיד חדש ל-state
  const addLocal = useCallback((student: Student) => {
    setStudents((prev) => {
      const next = [...prev, student];
      return next.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || "", "he"));
    });
    setLastUpdated(new Date());
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) {
      // logged out (or session not restored yet): drop data and invalidate any
      // request still in flight
      activeUserRef.current = null;
      requestSeqRef.current++;
      setStudents([]);
      setError("");
      return;
    }
    if (activeUserRef.current === userId) return; // StrictMode double-run guard
    activeUserRef.current = userId;
    refresh();
  }, [userId, refresh]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;                         // no subscription without a session
    const isCurrent = () => activeUserRef.current === userId;
    const channel = supabase
      .channel(`students-realtime-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        (payload) => {
          if (!isCurrent()) return;               // event for a previous session
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT") {
            const inserted = mapRow(newRow as Record<string, unknown>);
            setStudents((prev) => {
              // insert in correct alphabetical position
              const next = [...prev, inserted];
              return next.sort((a, b) =>
                (a.lastName || "").localeCompare(b.lastName || "", "he")
              );
            });
            setLastUpdated(new Date());
          }

          if (eventType === "UPDATE") {
            const updated = mapRow(newRow as Record<string, unknown>);
            setStudents((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            );
            setLastUpdated(new Date());
          }

          if (eventType === "DELETE") {
            const deletedId = (oldRow as Record<string, unknown>).id as string;
            setStudents((prev) => prev.filter((s) => s.id !== deletedId));
            setLastUpdated(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <StudentsContext.Provider
      value={{ students, loading, error, lastUpdated, refresh, updateLocal, removeLocal, addLocal }}
    >
      {children}
    </StudentsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStudents(): StudentsState {
  const ctx = useContext(StudentsContext);
  if (!ctx) {
    throw new Error("useStudents must be used inside <StudentsProvider>");
  }
  return ctx;
}
