import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Alumni } from "../types/student";
import { getAlumni } from "../api/alumniApi";
import { supabase } from "../lib/supabaseClient";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlumniState {
  alumni: Alumni[];
  loading: boolean;
  error: string;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  updateLocal: (updated: Alumni) => void;
  addLocal: (alumnus: Alumni) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AlumniContext = createContext<AlumniState | null>(null);

// ─── Helper: map a raw Supabase realtime row → Alumni ────────────────────────

// מחרוזת בטוחה — שומר אפסים מובילים (חשוב למספרי טלפון)
function s(val: unknown): string {
  if (val === null || val === undefined) return "";
  return String(val);
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AlumniProvider({ children }: { children: ReactNode }) {
  const [alumni, setAlumni] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // prevent double-fetch in StrictMode
  const fetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAlumni();
      setAlumni(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינת נתונים");
    } finally {
      setLoading(false);
    }
  }, []);

  // עדכון מיידי של בוגר אחד ב-state (ללא המתנה ל-Realtime)
  const updateLocal = useCallback((updated: Alumni) => {
    setAlumni((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a))
    );
    setLastUpdated(new Date());
  }, []);

  // הוספה מיידית של בוגר חדש ל-state
  const addLocal = useCallback((alumnus: Alumni) => {
    setAlumni((prev) => {
      const next = [...prev, alumnus];
      return next.sort((a, b) => (a.lastName || "").localeCompare(b.lastName || "", "he"));
    });
    setLastUpdated(new Date());
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    refresh();
  }, [refresh]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("alumni-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alumni" },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === "INSERT") {
            const inserted = mapRow(newRow as Record<string, unknown>);
            setAlumni((prev) => {
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
            setAlumni((prev) =>
              prev.map((a) => (a.id === updated.id ? updated : a))
            );
            setLastUpdated(new Date());
          }

          if (eventType === "DELETE") {
            const deletedId = (oldRow as Record<string, unknown>).id as string;
            setAlumni((prev) => prev.filter((a) => a.id !== deletedId));
            setLastUpdated(new Date());
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <AlumniContext.Provider
      value={{ alumni, loading, error, lastUpdated, refresh, updateLocal, addLocal }}
    >
      {children}
    </AlumniContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAlumni(): AlumniState {
  const ctx = useContext(AlumniContext);
  if (!ctx) {
    throw new Error("useAlumni must be used inside <AlumniProvider>");
  }
  return ctx;
}
