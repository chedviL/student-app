import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, X, Check, Loader2, GraduationCap, ChevronLeft } from "lucide-react";
import { useStudents } from "../context/StudentsContext";
import { useAlumni } from "../context/AlumniContext";
import { updateStudent } from "../api/studentsApi";
import { graduateStudent } from "../api/alumniApi";
import type { Student } from "../types/student";
import { useStudentTuition } from "../hooks/useStudentTuition";
import { TuitionModal } from "../components/tuition/TuitionModal";
import { formatDate } from "../utils/dateHelpers";
import "./SearchStudentPage.css";

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
  { key: "homePhone",          label: "טלפון בית", type: "tel" },
  { key: "city",               label: "עיר" },
  { key: "street",             label: "רחוב" },
  { key: "email",              label: "מייל",      type: "email" },
  { key: "age",                label: "גיל" },
  { key: "community",          label: "קהילה" },
  { key: "paymentStatusNotes", label: "הערה" },
  { key: "tuitionStartDate",   label: "תחילת גבייה" },
];

// 12 data fields + 1 birthdate = 13 fields, rows 14+15 = action buttons

// ─── helper: render value in view mode ───────────────────────────────────────

function renderValue(
  field: FieldDef,
  student: Student,
  copied: string | null,
  onCopy: (v: string, key: string) => void
) {
  const val = student[field.key] as string | undefined;

  if (field.key === "tuitionStartDate") {
    return <span className="profile-value">{formatDate(val ?? null)}</span>;
  }

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
  const { students, loading, error, updateLocal, removeLocal } = useStudents();
  const { addLocal: addAlumniLocal } = useAlumni();

  const [copied, setCopied]           = useState<string | null>(null);
  const [editMode, setEditMode]       = useState(false);
  const [draft, setDraft]             = useState<Partial<Student>>({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [graduateConfirm, setGraduateConfirm] = useState(false);
  const [graduating, setGraduating]           = useState(false);
  const [graduateError, setGraduateError]     = useState("");
  const [graduateDate, setGraduateDate]       = useState("");
  const [showTuition, setShowTuition]         = useState(false);

  const student = useMemo(
    () =>
      students.find(
        (s) => {
          const sid = String(studentId || "");
          if (s.passportOrId && String(s.passportOrId) === sid) return true;
          if (String(s.id) === sid) return true;
          return false;
        }
      ) ?? null,
    [students, studentId]
  );

  const { balance, loading: balLoading, refresh: refreshBalance } = useStudentTuition(student?.id ?? '');
  const tuitionCurrency = balance?.currency ?? null;
  const tuitionBal = balance?.currentBalance ?? 0;
  const tuitionSym = tuitionCurrency === 'USD' ? '$' : '₪';
  const tuitionLabel =
    balLoading
      ? '...'
      : !tuitionCurrency || balance?.status === 'no_currency'
      ? 'לא הוגדר'
      : tuitionBal === 0
      ? `0 ${tuitionSym}`
      : `${tuitionBal > 0 ? '+' : ''}${tuitionBal.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${tuitionSym}`;
  const tuitionBtnColor =
    balLoading || !tuitionCurrency || balance?.status === 'no_currency'
      ? { bg: 'linear-gradient(180deg,#f5f5f5,#e0e0e0)', color: '#666', border: '1px solid #ccc' }
      : tuitionBal < 0
      ? { bg: 'linear-gradient(180deg,#ffebee,#ef9a9a)', color: '#b71c1c', border: '1px solid rgba(198,40,40,0.4)' }
      : { bg: 'linear-gradient(180deg,#e8f5e9,#a5d6a7)', color: '#1b5e20', border: '1px solid rgba(46,125,50,0.4)' };

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

  async function handleGraduate() {
    if (!student) return;
    if (!graduateDate) { setGraduateError("יש להזין תאריך יציאה"); return; }
    setGraduating(true);
    setGraduateError("");
    try {
      const alumnus = await graduateStudent(student.id, graduateDate);
      removeLocal(student.id);
      addAlumniLocal(alumnus);
      navigate("/database");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה בהעברה";
      setGraduateError(msg.includes("כפילות") || msg.includes("unique") ? "בוגר עם ת״ז זו כבר קיים" : msg);
      setGraduating(false);
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
      {/* ── Graduate confirm modal ── */}
      {graduateConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => !graduating && setGraduateConfirm(false)}>
          <div style={{ background: "#fffdf8", border: "1px solid #d9b980", borderRadius: 22, padding: 28, width: 400, maxWidth: "90vw", textAlign: "center", boxShadow: "0 20px 50px rgba(92,53,23,0.2)", direction: "rtl" }}
            onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "#5b331a" }}>העברה לבוגרים</h3>
            <p style={{ color: "#5b331a", marginBottom: 18, fontSize: 15 }}>
              {student.lastName} {student.firstName}
            </p>

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8b6544", marginBottom: 6, textAlign: "right" }}>תאריך יציאה</label>
            <input
              type="date"
              value={graduateDate}
              onChange={(e) => setGraduateDate(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1.5px solid #e7d4af", background: "#fffdf8", color: "#3a1e08", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 16, direction: "ltr" }}
            />

            {graduateError && <p style={{ color: "#c00", marginBottom: 12, fontSize: 14 }}>{graduateError}</p>}

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={handleGraduate} disabled={graduating || !graduateDate}
                style={{ background: graduating || !graduateDate ? "#e0e0e0" : "linear-gradient(180deg,#1565c0,#0d47a1)", color: graduating || !graduateDate ? "#999" : "#fff", border: "none", borderRadius: 12, padding: "10px 22px", fontSize: 15, fontWeight: 700, cursor: graduating || !graduateDate ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8, transition: "background 0.2s" }}>
                {graduating ? <Loader2 size={16} className="spin" /> : <GraduationCap size={16} />}
                {graduating ? "מעביר..." : "אשר יציאה"}
              </button>
              <button onClick={() => { setGraduateConfirm(false); setGraduateError(""); setGraduateDate(""); }}
                style={{ background: "#f5f5f5", color: "#666", border: "1px solid #d9b980", borderRadius: 12, padding: "10px 22px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                בטל
              </button>
            </div>
          </div>
        </div>
      )}
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
                <>
                  <button className="profile-edit-btn" onClick={enterEdit}>
                    <Pencil size={16} />
                    ערוך
                  </button>
                </>
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

          {/* ── Unified grid: 12 data fields + birthdate + 2 action buttons ─── */}
          <motion.div className="student-profile-grid" variants={containerVariants}>
            {/* Data fields */}
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

            {/* כפתור חזרה */}
            <motion.div className="profile-item profile-item-btn" variants={itemVariants}>
              <button className="profile-grid-btn profile-grid-btn--back" onClick={() => navigate(-1)}>
                חזרה
              </button>
            </motion.div>

            {/* כפתור מצב שכ"ל */}
            <motion.div className="profile-item profile-item-btn" variants={itemVariants}>
              <button
                className="profile-grid-btn"
                onClick={() => setShowTuition(true)}
                style={{ background: tuitionBtnColor.bg, color: tuitionBtnColor.color, border: tuitionBtnColor.border }}
              >
                <span className="profile-tuition-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  מצב שכ"ל <ChevronLeft size={14} />
                </span>
                <span className="profile-tuition-balance">{tuitionLabel}</span>
              </button>
            </motion.div>

            {/* כפתור יצא / ריק במצב עריכה */}
            <motion.div className="profile-item profile-item-btn" variants={itemVariants}>
              {!editMode ? (
                <button
                  className="profile-grid-btn profile-grid-btn--graduate"
                  onClick={() => { setGraduateError(""); setGraduateDate(""); setGraduateConfirm(true); }}
                >
                  <GraduationCap size={16} />
                  יצא
                </button>
              ) : (
                <span style={{ color: "transparent" }}>—</span>
              )}
            </motion.div>

          </motion.div>

        </motion.section>
      </motion.div>

      {/* ── Tuition modal ─────────────────────────────────────────────── */}
      {showTuition && (
        <TuitionModal student={student} onClose={() => setShowTuition(false)} onTransactionAdded={refreshBalance} />
      )}
    </motion.div>
  );
}
