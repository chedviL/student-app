import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, BookOpen, MapPin, Check, X, Loader2, Pencil, Download, UserPlus, GraduationCap } from "lucide-react";
import { exportToExcel, todayStr } from "../utils/excelExport";
import type { ExportColDef } from "../utils/excelExport";
import { useStudents } from "../context/StudentsContext";
import { useAlumni } from "../context/AlumniContext";
import { updateStudent, createStudent } from "../api/studentsApi";
import { graduateStudent } from "../api/alumniApi";
import type { Student } from "../types/student";
import "./DatabasePage.css";

// ─── Column definitions ───────────────────────────────────────────────────────

type ColDef = {
  key: keyof Student;
  label: string;
  width?: number;
  dir?: "ltr";
  editable?: boolean;
};

const COLUMNS: ColDef[] = [
  { key: "lastName",      label: "משפחה",       width: 110, editable: true },
  { key: "firstName",     label: "שם",           width: 90,  editable: true },
  { key: "className",     label: "שיעור",        width: 80,  editable: true },
  { key: "passportOrId",  label: 'ת"ז',          width: 110, dir: "ltr" },
  { key: "age",           label: "גיל",          width: 56,  editable: true },
  { key: "community",     label: "קהילה",        width: 100, editable: true },
  { key: "fatherName",    label: "שם האב",       width: 110, editable: true },
  { key: "motherName",    label: "שם האם",       width: 110, editable: true },
  { key: "fatherPhone",   label: "טל׳ אב",       width: 110, dir: "ltr", editable: true },
  { key: "motherPhone",   label: "טל׳ אם",       width: 110, dir: "ltr", editable: true },
  { key: "homePhone",     label: "טל׳ בית",      width: 110, dir: "ltr", editable: true },
  { key: "email",         label: "מייל הורים",   width: 140, dir: "ltr", editable: true },
  { key: "city",          label: "עיר",          width: 90,  editable: true },
  { key: "street",        label: "רחוב",         width: 120, editable: true },
  { key: "tuition",       label: 'שכ"ל',         width: 80,  editable: true },
  { key: "tuitionRank",   label: "דרגה",         width: 70,  editable: true },
  { key: "paymentMethod", label: "אמצעי",        width: 90,  editable: true },
  { key: "paymentStatusNotes", label: "הערות",   width: 140, editable: true },
  { key: "boarding",      label: "פנימייה",      width: 80,  editable: true },
  { key: "hebrewDate",    label: "תאריך עברי",   width: 110, editable: true },
  { key: "gregorianDate", label: "תאריך לועזי",  width: 110, editable: true },
];

// ─── Filter components (same pattern as SortedListsPage) ─────────────────────

// ─── Format gregorian date DD.MM.YYYY ────────────────────────────────────────
function fmtDate(val: string | undefined): string {
  if (!val) return "";
  // already has dots → return as-is
  if (val.includes(".")) return val;
  // YYYY-MM-DD → DD.MM.YYYY
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  // MM/DD/YYYY → DD.MM.YYYY
  const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2].padStart(2,"0")}.${m2[1].padStart(2,"0")}.${m2[3]}`;
  // Excel serial number (e.g. 39407) → DD.MM.YYYY
  const n = Number(val);
  if (!isNaN(n) && n > 1000 && n < 100000) {
    // Excel epoch: 1 Jan 1900 = day 1 (with leap year bug: day 60 = 29 Feb 1900 which didn't exist)
    const excelEpoch = new Date(1899, 11, 30); // 30 Dec 1899
    const date = new Date(excelEpoch.getTime() + n * 86400000);
    const d = String(date.getDate()).padStart(2, "0");
    const mo = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    return `${d}.${mo}.${y}`;
  }
  return val;
}

function FilterInput({
  label, options, value, onChange,
}: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = options.filter((o) => o.toLowerCase().includes(value.toLowerCase()));
  return (
    <div className="filter-dropdown" ref={ref}>
      <button className={`filter-btn${value ? " filter-btn-active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {label}{value ? ` "${value}"` : ""} ▾
      </button>
      {open && (
        <div className="filter-menu">
          <input autoFocus className="filter-search-input" placeholder={`חפש ${label}...`}
            value={value} onChange={(e) => onChange(e.target.value)} />
          {value && <button className="filter-clear" onClick={() => { onChange(""); setOpen(false); }}>נקה</button>}
          {filtered.map((opt) => (
            <div key={opt} className={`filter-option${value === opt ? " filter-option-selected" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}>{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterDropdown({
  label, options, selected, onChange, onClear,
}: {
  label: string; options: string[]; selected: Set<string>;
  onChange: (v: string) => void; onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="filter-dropdown" ref={ref}>
      <button className={`filter-btn${selected.size ? " filter-btn-active" : ""}`} onClick={() => setOpen((o) => !o)}>
        {label}{selected.size ? ` (${selected.size})` : ""} ▾
      </button>
      {open && (
        <div className="filter-menu">
          <button className="filter-clear" onClick={() => { onClear(); setOpen(false); }}>נקה הכל</button>
          {options.map((opt) => (
            <label key={opt} className="filter-option">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => onChange(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sub?: string;
}) {
  return (
    <motion.div
      className="db-stat-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="db-stat-icon">{icon}</div>
      <div className="db-stat-value">{value}</div>
      <div className="db-stat-label">{label}</div>
      {sub && <div className="db-stat-sub">{sub}</div>}
    </motion.div>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableCell({
  student,
  col,
  onSaved,
}: {
  student: Student;
  col: ColDef;
  onSaved: (updated: Student) => void;
}) {
  const { updateLocal } = useStudents();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(student[col.key] ?? ""));
  const [saving, setSaving] = useState(false);

  const original = String(student[col.key] ?? "");

  async function save() {
    if (value === original) { setEditing(false); return; }
    setSaving(true);
    try {
      const saved = await updateStudent(student.id, { [col.key]: value });
      updateLocal(saved);
      onSaved(saved);
      setEditing(false);
    } catch {
      setValue(original);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setValue(original);
    setEditing(false);
  }

  if (!col.editable) {
    return (
      <span dir={col.dir} style={col.dir === "ltr" ? { unicodeBidi: "isolate" } : undefined}>
        {col.key === "gregorianDate" ? fmtDate(original) : (original || "—")}
      </span>
    );
  }

  if (editing) {
    return (
      <div className="db-cell-edit">
        <input
          className="db-cell-input"
          autoFocus
          value={value}
          dir={col.dir}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          disabled={saving}
        />
        <div className="db-cell-actions">
          {saving
            ? <Loader2 size={13} className="spin" />
            : <>
                <button className="db-cell-ok"  onClick={save}><Check size={13} /></button>
                <button className="db-cell-cancel" onClick={cancel}><X size={13} /></button>
              </>
          }
        </div>
      </div>
    );
  }

  return (
    <span
      className="db-cell-view"
      onClick={() => { setValue(original); setEditing(true); }}
      title="לחץ לעריכה"
      dir={col.dir}
    >
      {col.key === "gregorianDate"
        ? (fmtDate(original) || <span className="db-cell-empty">—</span>)
        : (original || <span className="db-cell-empty">—</span>)}
      <Pencil size={11} className="db-cell-edit-icon" />
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DatabasePage() {
  const { students: raw, loading, error, removeLocal, addLocal } = useStudents();
  const { addLocal: addAlumniLocal } = useAlumni();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"lastNameAsc" | "classNameAsc" | "classThenName">("lastNameAsc");
  const [lastNameFilter, setLastNameFilter] = useState("");
  const [firstNameFilter, setFirstNameFilter] = useState("");
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set());
  const [communityFilter, setCommunityFilter] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState("");
  const [boardingFilter, setBoardingFilter] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<Set<string>>(
    new Set(COLUMNS.map((c) => c.key))
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({});
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [graduateTarget, setGraduateTarget] = useState<Student | null>(null);
  const [graduateDate, setGraduateDate] = useState("");
  const [graduating, setGraduating] = useState(false);
  const [graduateError, setGraduateError] = useState("");
  const [graduateSuccess, setGraduateSuccess] = useState("");

  // local copy so inline edits reflect immediately without full re-fetch
  const [localStudents, setLocalStudents] = useState<Student[]>([]);
  // sync from context when raw changes (initial load / realtime)
  useMemo(() => setLocalStudents(raw), [raw]);

  const handleSaved = useCallback((updated: Student) => {
    setLocalStudents((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  // ── filter + search + sort ──
  const displayed = useMemo(() => {
    let list = localStudents;
    if (lastNameFilter)       list = list.filter((s) => (s.lastName  || "").includes(lastNameFilter));
    if (firstNameFilter)      list = list.filter((s) => (s.firstName || "").includes(firstNameFilter));
    if (classFilter.size)     list = list.filter((s) => classFilter.has(s.className || ""));
    if (communityFilter.size) list = list.filter((s) => communityFilter.has(s.community || ""));
    if (cityFilter)           list = list.filter((s) => (s.city || "").includes(cityFilter));
    if (boardingFilter.size)  list = list.filter((s) => boardingFilter.has(s.boarding || ""));
    if (query.trim().length >= 1) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.lastName || "").toLowerCase().includes(q) ||
          (s.firstName || "").toLowerCase().includes(q) ||
          (s.passportOrId || "").includes(q)
      );
    }
    const cmp = (a: string, b: string) => a.localeCompare(b, "he", { sensitivity: "base" });
    list = [...list].sort((a, b) => {
      if (sortBy === "lastNameAsc")    return cmp(a.lastName || "", b.lastName || "");
      if (sortBy === "classNameAsc")   return cmp(a.className || "", b.className || "");
      const cc = cmp(a.className || "", b.className || "");
      return cc !== 0 ? cc : cmp(a.lastName || "", b.lastName || "");
    });
    return list;
  }, [localStudents, query, lastNameFilter, firstNameFilter, classFilter, communityFilter, cityFilter, boardingFilter, sortBy]);

  // ── stats ──
  const stats = useMemo(() => {
    const total = localStudents.length;
    const classes = new Set(localStudents.map((s) => s.className).filter(Boolean));
    const communities = new Set(localStudents.map((s) => s.community).filter(Boolean));
    return { total, classes: classes.size, communities: communities.size };
  }, [localStudents]);

  const lastNameOptions  = useMemo(() => [...new Set(localStudents.map((s) => s.lastName ).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")), [localStudents]);
  const firstNameOptions = useMemo(() => [...new Set(localStudents.map((s) => s.firstName).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")), [localStudents]);
  const classOptions     = useMemo(() => [...new Set(localStudents.map((s) => s.className).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")), [localStudents]);
  const communityOptions = useMemo(() => [...new Set(localStudents.map((s) => s.community).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")), [localStudents]);
  const cityOptions      = useMemo(() => [...new Set(localStudents.map((s) => s.city     ).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")), [localStudents]);
  const boardingOptions  = useMemo(() => [...new Set(localStudents.map((s) => s.boarding ).filter(Boolean))].sort((a,b) => a.localeCompare(b,"he")), [localStudents]);

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set); next.has(val) ? next.delete(val) : next.add(val); setFn(next);
  }

  const activeFilters = [lastNameFilter, firstNameFilter, cityFilter].filter(Boolean).length
    + classFilter.size + communityFilter.size + boardingFilter.size;

  function resetFilters() {
    setQuery(""); setLastNameFilter(""); setFirstNameFilter("");
    setClassFilter(new Set()); setCommunityFilter(new Set());
    setCityFilter(""); setBoardingFilter(new Set());
  }

  async function saveNewStudent() {
    if (!newStudent.firstName?.trim() && !newStudent.lastName?.trim()) {
      setAddError("נדרש לפחות שם פרטי או שם משפחה");
      return;
    }
    setAddSaving(true);
    setAddError("");
    try {
      const fullName = `${newStudent.lastName || ""} ${newStudent.firstName || ""}`.trim();
      const created = await createStudent({ ...newStudent, fullName } as Omit<Student, "id">);
      addLocal(created);
      setShowAddModal(false);
      setNewStudent({});
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleGraduate(student: Student) {
    if (!graduateDate) {
      setGraduateError("יש להזין תאריך עזיבה");
      return;
    }

    setGraduating(true);
    setGraduateError("");
    try {
      const alumnus = await graduateStudent(student.id, graduateDate);
      removeLocal(student.id);
      addAlumniLocal(alumnus);
      setGraduateTarget(null);
      setGraduateDate("");
      setGraduateSuccess(`${student.lastName} ${student.firstName} הועבר לרשימת הבוגרים`);
      setTimeout(() => setGraduateSuccess(""), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "שגיאה בהעברה";
      setGraduateError(msg.includes("כפילות") || msg.includes("unique") ? "בוגר עם ת״ז זו כבר קיים" : msg);
    } finally {
      setGraduating(false);
    }
  }

  function handleExportToExcel() {
    const exportCols: ExportColDef[] = COLUMNS
      .filter((c) => selectedExportFields.has(c.key))
      .map((c) => ({
        key: c.key,
        label: c.label,
        type: c.key === 'gregorianDate' ? 'date'
            : c.key === 'tuition' ? 'number'
            : undefined,
      }));
    exportToExcel(
      displayed as unknown as Record<string, unknown>[],
      exportCols,
      'תלמידים',
      `רשימת_תלמידים_${todayStr()}.xlsx`,
    );
    setShowExportModal(false);
  }

  return (
    <motion.div
      className="db-page with-navbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="db-shell">

        {/* ── Header ── */}
        <div className="db-header">
          <h1 className="db-title">מסד נתונים</h1>
          <p className="db-subtitle">סקירה כללית ועריכה ישירה של נתוני התלמידים</p>
        </div>

        {/* ── Stats row ── */}
        {!loading && !error && (
          <div className="db-stats-row">
            <StatCard icon={<Users size={18} />}     value={stats.total}       label="סה״כ תלמידים" />
            <StatCard icon={<BookOpen size={18} />}  value={stats.classes}     label="שיעורים"       />
            <StatCard icon={<MapPin size={18} />}    value={stats.communities} label="קהילות"        />
          </div>
        )}

        {/* ── Toolbar ── */}
        {!loading && !error && (
          <div className="db-toolbar">
            <div className="db-toolbar-row">
              <input
                className="db-search"
                placeholder="חיפוש לפי שם או ת״ז..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="db-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="lastNameAsc">מיון: שם משפחה א-ת</option>
                <option value="classNameAsc">מיון: שיעור</option>
                <option value="classThenName">מיון: שיעור + משפחה</option>
              </select>
              <span className="db-count">
                מציג <strong>{displayed.length}</strong> מתוך {localStudents.length}
              </span>
              {(activeFilters > 0 || query) && (
                <button className="db-reset-btn" onClick={resetFilters}>
                  ✕ נקה סינון {activeFilters > 0 && `(${activeFilters})`}
                </button>
              )}
              <button className="db-export-btn" onClick={() => setShowExportModal(true)}>
                <Download size={15} /> ייצוא
              </button>
              <button className="db-add-btn" onClick={() => { setNewStudent({}); setAddError(""); setShowAddModal(true); }}>
                <UserPlus size={15} /> הוסף תלמיד
              </button>
            </div>
          </div>
        )}

        {/* ── Export modal ── */}
        {showExportModal && (
          <div className="export-modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="export-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="export-modal-title">בחר שדות לייצוא</h3>
              <div className="export-modal-actions">
                <button className="export-modal-btn" onClick={() => setSelectedExportFields(new Set(COLUMNS.map((c) => c.key)))}>בחר הכל</button>
                <button className="export-modal-btn" onClick={() => setSelectedExportFields(new Set())}>נקה הכל</button>
              </div>
              <div className="export-fields-grid">
                {COLUMNS.map((c) => (
                  <label key={c.key} className="export-field-option">
                    <input
                      type="checkbox"
                      checked={selectedExportFields.has(c.key)}
                      onChange={() => {
                        const next = new Set(selectedExportFields);
                        next.has(c.key) ? next.delete(c.key) : next.add(c.key);
                        setSelectedExportFields(next);
                      }}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              <div className="export-modal-footer">
                <button className="db-export-btn" onClick={handleExportToExcel} disabled={selectedExportFields.size === 0}>
                  <Download size={15} /> ייצוא ({selectedExportFields.size} שדות)
                </button>
                <button className="export-modal-cancel" onClick={() => setShowExportModal(false)}>בטל</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Add student modal ── */}
        {showAddModal && (
          <div className="export-modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="export-modal db-add-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="export-modal-title">הוספת תלמיד חדש</h3>

              {addError && <div className="edit-feedback error" style={{ marginBottom: 12 }}>{addError}</div>}

              <div className="db-add-fields">
                {/* שם */}
                <div className="db-add-section-title">פרטים אישיים</div>
                {[
                  { key: "lastName",      label: "שם משפחה" },
                  { key: "firstName",     label: "שם פרטי" },
                  { key: "passportOrId",  label: 'ת"ז / דרכון' },
                  { key: "age",           label: "גיל" },
                  { key: "hebrewDate",    label: "תאריך לידה עברי" },
                  { key: "gregorianDate", label: "תאריך לידה לועזי" },
                ].map((f) => (
                  <div key={f.key} className="db-add-field">
                    <label className="edit-label">{f.label}</label>
                    <input className="edit-input"
                      value={(newStudent as Record<string,string>)[f.key] ?? ""}
                      onChange={(e) => setNewStudent((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.label} />
                  </div>
                ))}

                <div className="db-add-section-title">שיעור וקהילה</div>
                {[
                  { key: "className",  label: "שיעור" },
                  { key: "community",  label: "קהילה" },
                  { key: "fatherName", label: "שם האב" },
                  { key: "motherName", label: "שם האם" },
                ].map((f) => (
                  <div key={f.key} className="db-add-field">
                    <label className="edit-label">{f.label}</label>
                    <input className="edit-input"
                      value={(newStudent as Record<string,string>)[f.key] ?? ""}
                      onChange={(e) => setNewStudent((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.label} />
                  </div>
                ))}

                <div className="db-add-section-title">טלפונים וכתובת</div>
                {[
                  { key: "homePhone",   label: "טלפון בית" },
                  { key: "fatherPhone", label: "טלפון אב" },
                  { key: "motherPhone", label: "טלפון אם" },
                  { key: "city",        label: "עיר" },
                  { key: "street",      label: "רחוב" },
                  { key: "email",       label: "מייל" },
                ].map((f) => (
                  <div key={f.key} className="db-add-field">
                    <label className="edit-label">{f.label}</label>
                    <input className="edit-input"
                      value={(newStudent as Record<string,string>)[f.key] ?? ""}
                      onChange={(e) => setNewStudent((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.label} />
                  </div>
                ))}

                <div className="db-add-section-title">שכר לימוד</div>
                {[
                  { key: "tuition",            label: "שכר לימוד" },
                  { key: "tuitionRank",         label: "דרגה" },
                  { key: "paymentMethod",       label: "אמצעי תשלום" },
                  { key: "paymentStatusNotes",  label: "הערות" },
                  { key: "boarding",            label: "פנימייה" },
                ].map((f) => (
                  <div key={f.key} className="db-add-field">
                    <label className="edit-label">{f.label}</label>
                    <input className="edit-input"
                      value={(newStudent as Record<string,string>)[f.key] ?? ""}
                      onChange={(e) => setNewStudent((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.label} />
                  </div>
                ))}
              </div>

              <div className="export-modal-footer" style={{ marginTop: 20 }}>
                <button className="db-add-btn" onClick={saveNewStudent} disabled={addSaving}>
                  {addSaving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                  {addSaving ? "שומר..." : "שמור תלמיד"}
                </button>
                <button className="export-modal-cancel" onClick={() => setShowAddModal(false)}>בטל</button>
              </div>
            </div>
          </div>
        )}
        {loading && <p className="search-state">טוען נתונים...</p>}
        {error   && <p className="search-error">{error}</p>}
        {graduateSuccess && (
          <div style={{ textAlign: "center", padding: "10px 16px", background: "rgba(45,90,45,0.1)", border: "1px solid rgba(46,125,50,0.3)", borderRadius: 10, marginBottom: 12, color: "#1b5e20", fontWeight: 700, fontSize: 14 }}>
            ✔ {graduateSuccess}
          </div>
        )}

        {/* ── Graduate confirm modal ── */}
        {graduateTarget && (
          <div className="export-modal-overlay" onClick={() => { if (!graduating) { setGraduateTarget(null); setGraduateError(""); setGraduateDate(""); } }}>
            <div className="export-modal" style={{ maxWidth: 400, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
              <h3 className="export-modal-title">העברה לבוגרים</h3>
              <p style={{ color: "#5b331a", marginBottom: 16, fontSize: 15 }}>
                האם להעביר את <strong>{graduateTarget.lastName} {graduateTarget.firstName}</strong> לרשימת הבוגרים?
              </p>

              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8b6544", marginBottom: 6, textAlign: "right" }}>
                תאריך עזיבה
              </label>
              <input
                type="date"
                value={graduateDate}
                onChange={(e) => setGraduateDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "1.5px solid #e7d4af",
                  background: "#fffdf8",
                  color: "#3a1e08",
                  fontSize: 14,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: 16,
                  direction: "ltr",
                }}
              />

              {graduateError && <p style={{ color: "#c00", marginBottom: 12, fontSize: 14 }}>{graduateError}</p>}
              <div className="export-modal-footer">
                <button
                  className="db-add-btn"
                  onClick={() => handleGraduate(graduateTarget)}
                  disabled={graduating || !graduateDate}
                  style={{ background: graduating || !graduateDate ? "#e0e0e0" : "linear-gradient(180deg, #3d3460, #5a4da0)", color: graduating || !graduateDate ? "#999" : "#e0deff", border: "1px solid rgba(124,111,205,0.4)", cursor: graduating || !graduateDate ? "not-allowed" : "pointer" }}
                >
                  {graduating ? <Loader2 size={15} className="spin" /> : <GraduationCap size={15} />}
                  {graduating ? "מעביר..." : "אשר עזיבה"}
                </button>
                <button className="export-modal-cancel" onClick={() => { setGraduateTarget(null); setGraduateError(""); setGraduateDate(""); }}>בטל</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        {!loading && !error && (
          <div className="db-table-card">
            <div className="db-table-scroll">
              <table className="db-table">
                <thead>
                  <tr>
                    <th className="db-th-row-num">#</th>
                    <th className="db-th-link">כרטיס</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} style={{ minWidth: col.width, overflow: "visible" }}>
                        {col.key === "lastName" ? (
                          <FilterInput label="משפחה" options={lastNameOptions} value={lastNameFilter} onChange={setLastNameFilter} />
                        ) : col.key === "firstName" ? (
                          <FilterInput label="שם" options={firstNameOptions} value={firstNameFilter} onChange={setFirstNameFilter} />
                        ) : col.key === "className" ? (
                          <FilterDropdown label="שיעור" options={classOptions} selected={classFilter}
                            onChange={(v) => toggleSet(classFilter, setClassFilter, v)} onClear={() => setClassFilter(new Set())} />
                        ) : col.key === "community" ? (
                          <FilterDropdown label="קהילה" options={communityOptions} selected={communityFilter}
                            onChange={(v) => toggleSet(communityFilter, setCommunityFilter, v)} onClear={() => setCommunityFilter(new Set())} />
                        ) : col.key === "city" ? (
                          <FilterInput label="עיר" options={cityOptions} value={cityFilter} onChange={setCityFilter} />
                        ) : col.key === "boarding" ? (
                          <FilterDropdown label="פנימייה" options={boardingOptions} selected={boardingFilter}
                            onChange={(v) => toggleSet(boardingFilter, setBoardingFilter, v)} onClear={() => setBoardingFilter(new Set())} />
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                    <th className="db-th-link">עזב</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {displayed.map((student, idx) => (
                      <tr
                        key={student.id}
                        className="db-row"
                        style={{ animationDelay: `${Math.min(idx, 30) * 25}ms` }}
                      >
                        <td className="db-td-num">{idx + 1}</td>
                        <td className="db-td-link">
                          <button
                            className="db-card-btn"
                            onClick={() => navigate(`/student/${student.passportOrId || student.id}`)}
                            title="פתח כרטיס"
                          >
                            ←
                          </button>
                        </td>
                        {COLUMNS.map((col) => (
                          <td key={col.key} className="db-td">
                            <EditableCell
                              student={student}
                              col={col}
                              onSaved={handleSaved}
                            />
                          </td>
                        ))}
                        <td className="db-td-link">
                          <button
                            className="db-graduate-btn"
                            onClick={() => { setGraduateError(""); setGraduateDate(""); setGraduateTarget(student); }}
                            title="עזב — העבר לבוגרים"
                          >
                            <GraduationCap size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {displayed.length === 0 && (
                <p className="db-empty">לא נמצאו תלמידים</p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}