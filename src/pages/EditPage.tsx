import { useState, useMemo } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pencil, Users, User, Search, ChevronRight,
  Check, X, Loader2, Phone, BookOpen, MapPin,
  StickyNote, CreditCard,
} from "lucide-react";
import { useStudents } from "../context/StudentsContext";
import { updateStudent } from "../api/studentsApi";
import type { Student } from "../types/student";
import "./EditPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type TopMode = "single" | "bulk" | null;
type EditSection = "personal" | "contact" | "class" | "payment" | "address" | "notes" | null;

interface FieldDef {
  key: keyof Student;
  label: string;
  type?: "text" | "email" | "tel" | "date";
  span?: boolean; // full-width field
}

// ─── Section definitions ─────────────────────────────────────────────────────

const SECTIONS: {
  id: EditSection;
  label: string;
  desc: string;
  iconName: string;
  iconClass: string;
  fields: FieldDef[];
}[] = [
  {
    id: "personal",
    label: "פרטים אישיים",
    desc: 'שם, גיל, תאריך לידה, ת"ז',
    iconName: "User",
    iconClass: "icon-personal",
    fields: [
      { key: "lastName",      label: "שם משפחה" },
      { key: "firstName",     label: "שם פרטי" },
      { key: "age",           label: "גיל" },
      { key: "hebrewDate",    label: "תאריך עברי" },
      { key: "gregorianDate", label: "תאריך לועזי" },
      { key: "passportOrId",  label: "ת\"ז / דרכון" },
    ],
  },
  {
    id: "contact",
    label: "טלפונים",
    desc: "טלפון בית, אב, אם, איש קשר",
    iconName: "Phone",
    iconClass: "icon-contact",
    fields: [
      { key: "homePhone",    label: "טלפון בית",    type: "tel" },
      { key: "fatherPhone",  label: "טלפון אב",     type: "tel" },
      { key: "motherPhone",  label: "טלפון אם",     type: "tel" },
      { key: "contactPhone", label: "איש קשר",      type: "tel" },
      { key: "email",        label: "מייל",         type: "email", span: true },
    ],
  },
  {
    id: "class",
    label: "שיעור וקהילה",
    desc: "שיעור, קהילה, שם אב, שם אם",
    iconName: "BookOpen",
    iconClass: "icon-class",
    fields: [
      { key: "className",  label: "שיעור" },
      { key: "community",  label: "קהילה" },
      { key: "fatherName", label: "שם האב" },
      { key: "motherName", label: "שם האם" },
      { key: "fatherId",   label: "ת\"ז אב" },
    ],
  },
  {
    id: "address",
    label: "כתובת",
    desc: "עיר, רחוב, כתובת איש קשר",
    iconName: "MapPin",
    iconClass: "icon-address",
    fields: [
      { key: "city",           label: "עיר" },
      { key: "street",         label: "רחוב", span: true },
      { key: "contactAddress", label: "כתובת איש קשר", span: true },
    ],
  },
  {
    id: "payment",
    label: "שכר לימוד ותשלומים",
    desc: "שכ\"ל, אמצעי, אמצעי תשלום",
    iconName: "CreditCard",
    iconClass: "icon-payment",
    fields: [
      { key: "tuition",            label: "שכר לימוד" },
      { key: "tuitionRank",        label: "אמצעי" },
      { key: "tuitionStartDate",   label: "תאריך תחילת גבייה", type: "date" as const },
      { key: "paymentMethod",      label: "אמצעי תשלום" },
      { key: "dueDateNote",        label: "הערת מועד" },
      { key: "credit",             label: "אשראי" },
      { key: "bankTransfer",       label: "העברה בנקאית" },
      { key: "endOfYear",          label: "סוף שנה" },
    ],
  },
  {
    id: "notes",
    label: "הערות",
    desc: "הערות תשלום, פנימייה, חינוך",
    iconName: "StickyNote",
    iconClass: "icon-notes",
    fields: [
      { key: "paymentStatusNotes", label: "הערות תשלום", span: true },
      { key: "boarding",           label: "פנימייה" },
      { key: "education",          label: "חינוך" },
      { key: "educationType",      label: "סוג חינוך" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(t: string) {
  return (t || "").toLowerCase().replace(/['״׳]/g, "").replace(/\s+/g, " ").trim();
}

function SectionIcon({ name, size = 22 }: { name: string; size?: number }) {
  const icons: Record<string, React.ReactNode> = {
    User:       <User size={size} />,
    Phone:      <Phone size={size} />,
    BookOpen:   <BookOpen size={size} />,
    MapPin:     <MapPin size={size} />,
    CreditCard: <CreditCard size={size} />,
    StickyNote: <StickyNote size={size} />,
  };
  return icons[name] ?? <Pencil size={size} />;
}

// ─── Sub-component: Student search picker ────────────────────────────────────

function StudentPicker({
  onSelect,
}: {
  onSelect: (s: Student) => void;
}) {
  const { students, loading } = useStudents();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return students.filter((s) => {
      const fn = normalize(s.firstName);
      const ln = normalize(s.lastName);
      const id = (s.passportOrId || "").replace(/\D/g, "");
      const terms = q.split(" ").filter(Boolean);
      const textMatch = terms.every(
        (t) =>
          fn.split(" ").some((w) => w.startsWith(t)) ||
          ln.split(" ").some((w) => w.startsWith(t))
      );
      const numQ = query.replace(/\D/g, "");
      return textMatch || (numQ.length >= 2 && id.includes(numQ));
    });
  }, [query, students]);

  return (
    <div className="edit-search-wrap">
      <div className="search-toolbar" style={{ marginBottom: 16 }}>
        <div className="search-input-wrap">
          <Search size={20} className="search-icon" />
          <input
            className="search-input"
            placeholder={'חפש תלמיד לפי שם או ת"ז'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>
      {loading && <p className="search-state">טוען...</p>}
      {!loading && normalize(query).length >= 2 && results.length === 0 && (
        <p className="search-state">לא נמצאו תוצאות</p>
      )}
      {results.length > 0 && (
        <div className="students-list">
          {results.map((s) => (
            <div
              key={s.id}
              className="student-row-card clickable-student-row"
              onClick={() => onSelect(s)}
            >
              <div className="student-row-main">
                <h3 className="student-row-name">
                  {s.lastName || "-"} {s.firstName || ""}
                </h3>
                <div className="student-row-meta">
                  <span className="student-row-meta-item">
                    <span className="meta-label">ת"ז:</span>
                    <span className="meta-value meta-id">{s.passportOrId || "-"}</span>
                  </span>
                  <span className="student-row-separator">•</span>
                  <span className="student-row-meta-item">
                    <span className="meta-label">שיעור:</span>
                    <span className="meta-value">{s.className || "-"}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Edit form (single or bulk) ───────────────────────────────

// ─── Relative operation type ─────────────────────────────────────────────────

type RelOp = "set" | "add" | "subtract" | "multiply";

interface FieldOp {
  mode: RelOp;
  value: string; // raw input string
}

function applyOp(current: string, op: FieldOp): string {
  if (op.mode === "set") return op.value;
  const cur = parseFloat(current ?? "0") || 0;
  const val = parseFloat(op.value) || 0;
  if (op.mode === "add")      return String(Math.round((cur + val) * 1000) / 1000);
  if (op.mode === "subtract") return String(Math.round((cur - val) * 1000) / 1000);
  if (op.mode === "multiply") return String(Math.round((cur * val) * 1000) / 1000);
  return op.value;
}

const OP_LABELS: Record<RelOp, string> = {
  set:      "הגדר",
  add:      "הוסף +",
  subtract: "הפחת −",
  multiply: "כפל ×",
};

// ─── EditForm ─────────────────────────────────────────────────────────────────

function EditForm({
  section,
  students,
  onDone,
  onBack,
}: {
  section: NonNullable<EditSection>;
  students: Student[];
  onDone: (updated: Student[]) => void;
  onBack: () => void;
}) {
  const { updateLocal } = useStudents();
  const sec = SECTIONS.find((s) => s.id === section)!;
  const isBulk = students.length > 1;

  // For single mode: full student copy. For bulk: empty (only filled fields change).
  const [draft, setDraft] = useState<Partial<Student>>(
    isBulk ? {} : { ...students[0] }
  );

  // Per-field operation config (only relevant in bulk mode for numeric fields)
  const [fieldOps, setFieldOps] = useState<Partial<Record<keyof Student, FieldOp>>>({});

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function change(key: keyof Student, val: string) {
    setDraft((d) => ({ ...d, [key]: val }));
    // keep fieldOp value in sync
    setFieldOps((prev) => ({
      ...prev,
      [key]: { mode: prev[key]?.mode ?? "set", value: val },
    }));
  }

  function setOp(key: keyof Student, mode: RelOp) {
    setFieldOps((prev) => ({
      ...prev,
      [key]: { mode, value: prev[key]?.value ?? "" },
    }));
  }

  // Compute the actual value to save per student per field
  function resolveValue(key: keyof Student, student: Student): string | undefined {
    const raw = draft[key] as string | undefined;
    if (!raw && raw !== "0") return undefined; // empty = don't touch (bulk)
    const op = fieldOps[key];
    if (!op || op.mode === "set" || !isBulk) return raw;
    return applyOp(student[key] as string, op);
  }

  async function save() {
    // check at least one field has a value
    const hasChange = sec.fields.some((f) => {
      const v = draft[f.key] as string | undefined;
      return v !== undefined && v !== "" && (isBulk || v !== (students[0][f.key] as string));
    });
    if (!hasChange) {
      setFeedback({ type: "error", msg: "לא בוצעו שינויים" });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const results: Student[] = [];
      for (const st of students) {
        // build per-student patch
        const patch: Partial<Student> = {};
        for (const f of sec.fields) {
          const resolved = resolveValue(f.key, st);
          if (resolved !== undefined) (patch as Record<string, string>)[f.key] = resolved;
        }
        if (Object.keys(patch).length === 0) continue;
        const saved = await updateStudent(st.id, patch);
        updateLocal(saved);
        results.push(saved);
      }
      setFeedback({
        type: "success",
        msg: isBulk
          ? `✔ עודכנו ${results.length} תלמידים בהצלחה`
          : "✔ הנתונים נשמרו בהצלחה",
      });
      setTimeout(() => onDone(results), 1200);
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "שגיאה בשמירה" });
    } finally {
      setSaving(false);
    }
  }

  // Is a field numeric (supports relative ops)?
  function isNumeric(f: FieldDef) {
    return !f.type && ["age", "tuition", "tuitionRank", "credit"].includes(f.key as string);
  }

  return (
    <div className="edit-form-wrap">
      {isBulk && (
        <div className="edit-bulk-info">
          <Users size={16} />
          עדכון {students.length} תלמידים — שדות ריקים לא ישתנו
        </div>
      )}
      <div className="edit-form-card">
        <h3 className="edit-form-title">
          <span className={`edit-form-title-icon ${sec.iconClass}`}>
            <SectionIcon name={sec.iconName} size={20} />
          </span>
          {sec.label}
        </h3>

        <AnimatePresence>
          {feedback && (
            <motion.div
              className={`edit-feedback ${feedback.type}`}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {feedback.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="edit-fields">
          {sec.fields.map((f) => {
            const numeric = isNumeric(f);
            const currentOp: RelOp = fieldOps[f.key]?.mode ?? "set";
            const inputVal = isBulk
              ? (fieldOps[f.key]?.value ?? "")
              : ((draft[f.key] as string) ?? "");

            return (
              <div key={f.key} className="edit-field">
                <label className="edit-label">{f.label}</label>

                {/* Relative op selector — only in bulk mode for numeric fields */}
                {isBulk && numeric && (
                  <div className="edit-op-tabs">
                    {(["set", "add", "subtract", "multiply"] as RelOp[]).map((op) => (
                      <button
                        key={op}
                        type="button"
                        className={`edit-op-tab ${currentOp === op ? "active" : ""}`}
                        onClick={() => setOp(f.key, op)}
                        disabled={saving}
                      >
                        {OP_LABELS[op]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="edit-input-row">
                  {isBulk && numeric && currentOp !== "set" && (
                    <span className="edit-op-badge">
                      {currentOp === "add" ? "+" : currentOp === "subtract" ? "−" : "×"}
                    </span>
                  )}
                  <input
                    className="edit-input"
                    type={numeric ? "number" : (f.type ?? "text")}
                    step={numeric ? "any" : undefined}
                    dir={f.type === "tel" || f.type === "email" || f.type === "date" ? "ltr" : undefined}
                    value={inputVal}
                    onChange={(e) => change(f.key, e.target.value)}
                    placeholder={
                      isBulk
                        ? currentOp === "set"
                          ? "השאר ריק כדי לא לשנות"
                          : `הכנס מספר לפעולה`
                        : ((students[0][f.key] as string) || "")
                    }
                    disabled={saving}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="edit-form-actions">
          <button className="edit-back-link" onClick={onBack} type="button">
            <ChevronRight size={15} /> חזרה
          </button>
          <button className="edit-cancel-btn" onClick={onBack} disabled={saving}>
            <X size={16} /> ביטול
          </button>
          <button className="edit-save-btn" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
            {saving ? "שומר..." : "שמור שינויים"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-component: Bulk group picker ────────────────────────────────────────

function BulkPicker({
  onConfirm,
}: {
  onConfirm: (students: Student[]) => void;
}) {
  const { students: all } = useStudents();
  const [filterType, setFilterType] = useState<"class" | "community" | "manual" | "all">("class");
  const [filterValue, setFilterValue] = useState("");
  const [manualIds, setManualIds] = useState<Set<string>>(new Set());
  const [manualQuery, setManualQuery] = useState("");
  const [allConfirmed, setAllConfirmed] = useState(false);

  // unique values for dropdowns
  const classes = useMemo(
    () => [...new Set(all.map((s) => s.className).filter(Boolean))].sort(),
    [all]
  );
  const communities = useMemo(
    () => [...new Set(all.map((s) => s.community).filter(Boolean))].sort(),
    [all]
  );

  const filtered = useMemo(() => {
    if (filterType === "all")     return all;
    if (filterType === "class")   return filterValue ? all.filter((s) => s.className === filterValue) : [];
    if (filterType === "community") return filterValue ? all.filter((s) => s.community === filterValue) : [];
    return all.filter((s) => manualIds.has(s.id));
  }, [filterType, filterValue, manualIds, all]);

  const manualResults = useMemo(() => {
    const q = normalize(manualQuery);
    if (q.length < 2) return [];
    return all.filter((s) => {
      const fn = normalize(s.firstName);
      const ln = normalize(s.lastName);
      return (
        fn.split(" ").some((w) => w.startsWith(q)) ||
        ln.split(" ").some((w) => w.startsWith(q))
      );
    });
  }, [manualQuery, all]);

  function toggleManual(id: string) {
    setManualIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const canConfirm = filtered.length > 0;

  return (
    <div className="edit-search-wrap">
      {/* filter type tabs */}
      <div className="bulk-tabs">
        {(["class", "community", "manual", "all"] as const).map((t) => (
          <button
            key={t}
            className={`bulk-tab ${filterType === t ? "active" : ""}`}
            onClick={() => { setFilterType(t); setFilterValue(""); setAllConfirmed(false); }}
          >
            {t === "class" ? "לפי שיעור"
              : t === "community" ? "לפי קהילה"
              : t === "manual" ? "בחירה ידנית"
              : `כל התלמידים (${all.length})`}
          </button>
        ))}
      </div>

      {/* "all students" confirmation warning */}
      {filterType === "all" && !allConfirmed && (
        <div className="bulk-all-warning">
          <span className="bulk-all-warning-icon">⚠️</span>
          <div>
            <strong>שים לב — פעולה זו תשפיע על {all.length} תלמידים</strong>
            <p>כל שדה שתמלא ישוכתב לכל התלמידים במסד הנתונים.</p>
          </div>
          <button
            className="bulk-all-confirm-btn"
            onClick={() => setAllConfirmed(true)}
          >
            אני מבין, המשך
          </button>
        </div>
      )}

      {filterType === "all" && allConfirmed && (
        <div className="bulk-confirm-row">
          <span className="bulk-count">
            <Users size={16} /> כל {all.length} התלמידים נבחרו
          </span>
          <button className="edit-save-btn" onClick={() => onConfirm(all)}>
            המשך לעריכה <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* class / community dropdown */}
      {(filterType === "class" || filterType === "community") && (
        <div className="search-toolbar" style={{ marginBottom: 16 }}>
          <select
            className="edit-input edit-select"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
          >
            <option value="">
              {filterType === "class" ? "-- בחר שיעור --" : "-- בחר קהילה --"}
            </option>
            {(filterType === "class" ? classes : communities).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>
      )}

      {/* manual search */}
      {filterType === "manual" && (
        <div className="search-toolbar" style={{ marginBottom: 12 }}>
          <div className="search-input-wrap">
            <Search size={20} className="search-icon" />
            <input
              className="search-input"
              placeholder="חפש תלמידים להוספה לקבוצה"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* manual search results */}
      {filterType === "manual" && manualResults.length > 0 && (
        <div className="students-list" style={{ marginBottom: 16 }}>
          {manualResults.map((s) => (
            <div
              key={s.id}
              className={`student-row-card clickable-student-row ${manualIds.has(s.id) ? "bulk-selected" : ""}`}
              onClick={() => toggleManual(s.id)}
            >
              <div className="student-row-main">
                <h3 className="student-row-name" style={{ fontSize: 20 }}>
                  {manualIds.has(s.id) ? "✔ " : ""}{s.lastName} {s.firstName}
                </h3>
                <div className="student-row-meta">
                  <span className="student-row-meta-item">
                    <span className="meta-label">שיעור:</span>
                    <span className="meta-value">{s.className || "-"}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* result count + confirm */}
      {canConfirm && (
        <div className="bulk-confirm-row">
          <span className="bulk-count">
            <Users size={16} /> {filtered.length} תלמידים נבחרו
          </span>
          <button className="edit-save-btn" onClick={() => onConfirm(filtered)}>
            המשך לעריכה <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main EditPage ────────────────────────────────────────────────────────────

export default function EditPage() {
  const [topMode, setTopMode] = useState<TopMode>(null);

  // single mode
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  // bulk mode
  const [bulkStudents, setBulkStudents] = useState<Student[]>([]);

  // shared — which section to edit
  const [section, setSection] = useState<EditSection>(null);

  // derive which step we are on  (1 = choose mode, 2 = pick student/group, 3 = pick section, 4 = form)
  const step =
    topMode === null ? 1
    : topMode === "single" && !selectedStudent ? 2
    : topMode === "bulk"   && bulkStudents.length === 0 ? 2
    : section === null ? 3
    : 4;

  const activeStudents = topMode === "single" && selectedStudent
    ? [selectedStudent]
    : bulkStudents;

  function reset() {
    setTopMode(null);
    setSelectedStudent(null);
    setBulkStudents([]);
    setSection(null);
  }

  function handleDone() {
    // after save: go back to section picker (same student/group)
    setSection(null);
  }

  // ── Step labels ──
  const stepLabels = ["בחר מצב", "בחר תלמיד/ים", "בחר תחום", "ערוך"];

  return (
    <motion.div
      className="search-page with-navbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="search-shell">

        {/* Header */}
        <div className="edit-page-header">
          <h2 className="edit-page-title">
            <Pencil size={28} style={{ display: "inline", verticalAlign: "middle", marginLeft: 10, opacity: 0.7 }} />
            עריכת תלמידים
          </h2>
          <p className="edit-page-subtitle">
            ערוך תלמיד בודד או שנה נתונים לקבוצת תלמידים בבת אחת
          </p>
        </div>

        {/* Step indicator */}
        <div className="edit-steps">
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const isDone = step > num;
            const isActive = step === num;
            return (
              <>
                {i > 0 && <div key={`line-${i}`} className="edit-step-line" />}
                <div
                  key={label}
                  className={`edit-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
                >
                  <span className="edit-step-num">{isDone ? "✓" : num}</span>
                  {label}
                </div>
              </>
            );
          })}
        </div>

        <AnimatePresence mode="wait">

          {/* ── Step 1: Choose top mode ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="edit-modes-grid" style={{ maxWidth: 560, margin: "0 auto" }}>
                <div className="edit-mode-card" onClick={() => setTopMode("single")}>
                  <div className="edit-mode-icon icon-personal">
                    <User size={26} />
                  </div>
                  <span className="edit-mode-label">תלמיד בודד</span>
                  <span className="edit-mode-desc">חפש תלמיד ועדכן את הנתונים שלו</span>
                </div>
                <div className="edit-mode-card" onClick={() => setTopMode("bulk")}>
                  <div className="edit-mode-icon icon-class">
                    <Users size={26} />
                  </div>
                  <span className="edit-mode-label">עריכה בקבוצה</span>
                  <span className="edit-mode-desc">בחר שיעור, קהילה או תלמידים ידנית — שנה בבת אחת</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Step 2a: Pick single student ── */}
          {step === 2 && topMode === "single" && (
            <motion.div
              key="step2-single"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <button className="edit-back-link" onClick={reset} style={{ margin: "0 auto" }}>
                  <ChevronRight size={15} /> חזרה
                </button>
              </div>
              <StudentPicker onSelect={(s) => setSelectedStudent(s)} />
            </motion.div>
          )}

          {/* ── Step 2b: Pick bulk group ── */}
          {step === 2 && topMode === "bulk" && (
            <motion.div
              key="step2-bulk"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <button className="edit-back-link" onClick={reset} style={{ margin: "0 auto" }}>
                  <ChevronRight size={15} /> חזרה
                </button>
              </div>
              <BulkPicker onConfirm={(students) => setBulkStudents(students)} />
            </motion.div>
          )}

          {/* ── Step 3: Choose section ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              {/* student/group banner */}
              <div className="edit-student-banner" style={{ maxWidth: topMode === "bulk" ? 760 : 680 }}>
                <div>
                  {topMode === "single" && selectedStudent ? (
                    <>
                      <div className="edit-student-banner-name">
                        {selectedStudent.lastName} {selectedStudent.firstName}
                      </div>
                      <div className="edit-student-banner-meta">
                        ת"ז: {selectedStudent.passportOrId || "-"} &nbsp;|&nbsp; שיעור: {selectedStudent.className || "-"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="edit-student-banner-name">
                        <Users size={18} style={{ verticalAlign: "middle", marginLeft: 6 }} />
                        {bulkStudents.length} תלמידים נבחרו
                      </div>
                      <div className="edit-student-banner-meta">
                        {[...new Set(bulkStudents.map((s) => s.className).filter(Boolean))].join(", ") || "שיעורים מעורבים"}
                      </div>
                    </>
                  )}
                </div>
                <button className="edit-change-btn" onClick={reset}>החלף</button>
              </div>

              <div className="edit-modes-grid">
                {SECTIONS.map((sec) => (
                  <div
                    key={sec.id}
                    className="edit-mode-card"
                    onClick={() => setSection(sec.id)}
                  >
                    <div className={`edit-mode-icon ${sec.iconClass}`}>
                      <SectionIcon name={sec.iconName} size={24} />
                    </div>
                    <span className="edit-mode-label">{sec.label}</span>
                    <span className="edit-mode-desc">{sec.desc}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Step 4: Edit form ── */}
          {step === 4 && section && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <EditForm
                section={section}
                students={activeStudents}
                onDone={handleDone}
                onBack={() => setSection(null)}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
