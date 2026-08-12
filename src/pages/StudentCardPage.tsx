import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, X, Check, Loader2 } from "lucide-react";
import { useStudents } from "../context/StudentsContext";
import { updateStudent } from "../api/studentsApi";
import type { Student } from "../types/student";

function fmtDate(val: string | undefined): string {
  if (!val) return "";
  if (val.includes(".")) return val;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2].padStart(2,"0")}.${m2[1].padStart(2,"0")}.${m2[3]}`;
  const n = Number(val);
  if (!isNaN(n) && n > 1000 && n < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + n * 86400000);
    const d = String(date.getDate()).padStart(2, "0");
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}.${mo}.${y}`;
  }
  return val;
}

// ─── animation variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.15, staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.35 } },
};

// ─── field definitions ────────────────────────────────────────────────────────

type FieldDef = { key: keyof Student; label: string; type?: "text" | "email" | "tel" };

const DISPLAY_FIELDS: FieldDef[] = [
  { key: "fatherName",         label: "שם האב" },
  { key: "motherName",         label: "שם האם" },
  { key: "fatherPhone",        label: "טלפון אב",  type: "tel" },
  { key: "motherPhone",        label: "טלפון אם",  type: "tel" },
  { key: "homePhone",          label: "טלפון בית", type: "tel" },
  { key: "city",               label: "עיר" },
  { key: "street",             label: "רחוב" },
  { key: "email",              label: "מייל",      type: "email" },
  { key: "age",                label: "גיל" },
  { key: "community",          label: "קהילה" },
  { key: "paymentStatusNotes", label: "הערה" },
];

// ─── helper: render value in view mode ───────────────────────────────────────

function renderValue(
  field: FieldDef,
  student: Student,
  copied: string | null,
  onCopy: (v: string, key: string) => void
) {
  const val = student[field.key] as string | undefined;

  if (field.type === "email" && val) {
    return (
      <a
        href={`https://mail.google.com/mail/?view=cm&to=${val}`}
        target="_blank"
        rel="noreferrer"
        className="profile-value"
        style={{ fontSize: 15, direction: "ltr", unicodeBidi: "isolate" }}
      >
        {val}
      </a>
    );
  }

  if (field.type === "tel" && val) {
    return (
      <span
        className="profile-value phone-copy"
        onClick={() => onCopy(val, field.key)}
        title="לחץ להעתקה"
      >
        {copied === field.key ? "✔ הועתק!" : val}
      </span>
    );
  }

  return <span className="profile-value">{val || "-"}</span>;
}

// ─── main component ───────────────────────────────────────────────────────────

export default function StudentCardPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { students, loading, error, updateLocal } = useStudents();

  const [copied, setCopied]           = useState<string | null>(null);
  const [editMode, setEditMode]       = useState(false);
  const [draft, setDraft]             = useState<Partial<Student>>({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const student = useMemo(
    () =>
      students.find(
        (s) => String(s.passportOrId || s.id || "") === String(studentId || "")
      ) ?? null,
    [students, studentId]
  );

  function copyPhone(phone: string, key: string) {
    navigator.clipboard.writeText(phone);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function enterEdit() {
    if (!student) return;
    setDraft({ ...student });
    setSaveError("");
    setSaveSuccess(false);
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
    setDraft({});
    setSaveError("");
  }

  async function saveEdit() {
    if (!student) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await updateStudent(student.id, draft);
      // עדכון מיידי ב-Context — בלי המתנה ל-Realtime
      updateLocal(saved);
      setSaveSuccess(true);
      setEditMode(false);
      setDraft({});
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  // ── loading / error / not-found states ──────────────────────────────────────

  if (loading) {
    return (
      <div className="search-page with-navbar">
        <div className="search-shell">
          <p className="search-state">טוען כרטיס תלמיד...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-page with-navbar">
        <div className="search-shell">
          <p className="search-error">{error}</p>
          <button className="back-button" onClick={() => navigate(-1)}>חזרה</button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="search-page with-navbar">
        <div className="search-shell">
          <p className="search-state">התלמיד לא נמצא</p>
          <button className="back-button" onClick={() => navigate(-1)}>חזרה לחיפוש</button>
        </div>
      </div>
    );
  }

  // ── main render ──────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="search-page with-navbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="search-shell"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.section className="student-profile-card" variants={itemVariants}>

          {/* ── Action buttons row ──────────────────────────────────────────── */}
          <div className="profile-card-topbar">
            <div className="profile-action-btns">
              {!editMode ? (
                <button className="profile-edit-btn" onClick={enterEdit}>
                  <Pencil size={16} />
                  ערוך
                </button>
              ) : (
                <>
                  <button className="profile-save-btn" onClick={saveEdit} disabled={saving}>
                    {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
                    {saving ? "שומר..." : "שמור"}
                  </button>
                  <button className="profile-cancel-btn" onClick={cancelEdit}>
                    <X size={16} />
                    בטל
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Hero ────────────────────────────────────────────────────────── */}
          <div className="student-profile-hero">
            <div className="student-photo-placeholder" />

            <div className="student-profile-main">
              {editMode ? (
                <div className="profile-name-edit-row">
                  <input
                    className="profile-edit-input profile-name-input"
                    value={draft.lastName ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))}
                    placeholder="שם משפחה"
                  />
                  <input
                    className="profile-edit-input profile-name-input"
                    value={draft.firstName ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))}
                    placeholder="שם פרטי"
                  />
                </div>
              ) : (
                <h2 className="student-profile-name">
                  {student.lastName || "-"} {student.firstName || ""}
                </h2>
              )}

              <div className="student-profile-secondary">
                <span>ת"ז: {student.passportOrId || "-"}</span>
                <span className="student-profile-dot">•</span>
                {editMode ? (
                  <input
                    className="profile-edit-input profile-class-input"
                    value={draft.className ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, className: e.target.value }))}
                    placeholder="שיעור"
                  />
                ) : (
                  <span>שיעור: {student.className || "-"}</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Feedback banner — תמיד תופס מקום, רק הנראות משתנה ── */}
          <div className="profile-feedback-slot">
            <AnimatePresence>
              {saveSuccess && (
                <motion.div
                  className="profile-save-success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ✔ הנתונים נשמרו בהצלחה
                </motion.div>
              )}
              {saveError && (
                <motion.div
                  className="profile-save-error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  ✖ {saveError}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Fields grid ─────────────────────────────────────────────────── */}
          <motion.div className="student-profile-grid" variants={containerVariants}>
            {DISPLAY_FIELDS.map((field) => (
              <motion.div className="profile-item" key={field.key} variants={itemVariants}>
                <span className="profile-label">{field.label}</span>
                {editMode ? (
                  <input
                    className="profile-edit-input"
                    type={field.type ?? "text"}
                    value={(draft[field.key] as string) ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.label}
                    dir={field.type === "tel" ? "ltr" : field.type === "email" ? "ltr" : undefined}
                  />
                ) : (
                  renderValue(field, student, copied, copyPhone)
                )}
              </motion.div>
            ))}

            {/* תאריך לידה — עברי ולועזי באותו תא */}
            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">תאריך לידה</span>
              {editMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                  <input
                    className="profile-edit-input"
                    value={draft.hebrewDate ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, hebrewDate: e.target.value }))}
                    placeholder="עברי"
                  />
                  <input
                    className="profile-edit-input"
                    value={draft.gregorianDate ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, gregorianDate: e.target.value }))}
                    placeholder="לועזי"
                  />
                </div>
              ) : (
                <span className="profile-value" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {student.hebrewDate && <span>{student.hebrewDate}</span>}
                  {student.gregorianDate && <span style={{ direction: "ltr", unicodeBidi: "isolate", fontSize: 14 }}>{fmtDate(student.gregorianDate)}</span>}
                  {!student.hebrewDate && !student.gregorianDate && "-"}
                </span>
              )}
            </motion.div>

            {/* מצב שכ"ל */}
            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">מצב שכ"ל</span>
              <span className="tuition-badge tuition-neutral">טרם עודכן</span>
            </motion.div>
          </motion.div>

          {/* ── Back button ─────────────────────────────────────────────────── */}
          <div className="profile-back-row">
            <button className="back-button" onClick={() => navigate(-1)}>
              חזרה
            </button>
          </div>

        </motion.section>
      </motion.div>
    </motion.div>
  );
}
