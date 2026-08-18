import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, BookOpen, MapPin, Check, X, Loader2, Pencil, Download } from "lucide-react";
import { exportToExcel, todayStr } from "../utils/excelExport";
import type { ExportColDef } from "../utils/excelExport";
import { useAlumni } from "../context/AlumniContext";
import { updateAlumnus } from "../api/alumniApi";
import type { Alumni } from "../types/student";
import "./AlumniPage.css";
import "./DatabasePage.css";

// ─── Column definitions ───────────────────────────────────────────────────────

type ColDef = {
  key: keyof Alumni;
  label: string;
  width?: number;
  dir?: "ltr";
  editable?: boolean;
};

const ALUMNI_COLUMNS: ColDef[] = [
  { key: "lastName",           label: "משפחה",        width: 110, editable: true },
  { key: "firstName",          label: "שם",            width: 90,  editable: true },
  { key: "className",          label: "שיעור",         width: 80,  editable: true },
  { key: "passportOrId",       label: 'ת"ז',           width: 110, dir: "ltr" },
  { key: "age",                label: "גיל",           width: 56,  editable: true },
  { key: "community",          label: "קהילה",         width: 100, editable: true },
  { key: "fatherName",         label: "שם האב",        width: 110, editable: true },
  { key: "fatherPhone",        label: "טל׳ אב",        width: 110, dir: "ltr", editable: true },
  { key: "motherPhone",        label: "טל׳ אם",        width: 110, dir: "ltr", editable: true },
  { key: "alumniPhone",        label: "טל׳ בוגר",      width: 110, dir: "ltr" as const, editable: true },
  { key: "city",               label: "עיר",           width: 90,  editable: true },
  { key: "graduatedAt",        label: "תאריך יציאה",   width: 120, editable: false },
];

// ─── Format date DD.MM.YYYY ───────────────────────────────────────────────────

function fmtDate(val: string | undefined): string {
  if (!val) return "";
  if (val.includes(".")) return val;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2].padStart(2, "0")}.${m2[1].padStart(2, "0")}.${m2[3]}`;
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

// ─── Filter components ────────────────────────────────────────────────────────

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

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label,
}: {
  icon: React.ReactNode; value: string | number; label: string;
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
    </motion.div>
  );
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableCell({
  alumni,
  col,
  onSaved,
}: {
  alumni: Alumni;
  col: ColDef;
  onSaved: (updated: Alumni) => void;
}) {
  const { updateLocal } = useAlumni();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(alumni[col.key] ?? ""));
  const [saving, setSaving] = useState(false);

  const original = String(alumni[col.key] ?? "");

  async function save() {
    if (value === original) { setEditing(false); return; }
    setSaving(true);
    try {
      const saved = await updateAlumnus(alumni.id, { [col.key]: value });
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
        {col.key === "graduatedAt"
          ? (fmtDate(original) || "—")
          : col.key === "gregorianDate"
            ? fmtDate(original) || "—"
            : (original || "—")}
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
                <button className="db-cell-ok" onClick={save}><Check size={13} /></button>
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

export default function AlumniPage() {
  const { alumni: raw, loading, error } = useAlumni();
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
    new Set(ALUMNI_COLUMNS.map((c) => c.key))
  );

  // local copy so inline edits reflect immediately
  const [localAlumni, setLocalAlumni] = useState<Alumni[]>([]);
  useMemo(() => setLocalAlumni(raw), [raw]);

  const handleSaved = useCallback((updated: Alumni) => {
    setLocalAlumni((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  // ── filter + search + sort ──
  const displayed = useMemo(() => {
    let list = localAlumni;
    if (lastNameFilter)       list = list.filter((a) => (a.lastName  || "").includes(lastNameFilter));
    if (firstNameFilter)      list = list.filter((a) => (a.firstName || "").includes(firstNameFilter));
    if (classFilter.size)     list = list.filter((a) => classFilter.has(a.className || ""));
    if (communityFilter.size) list = list.filter((a) => communityFilter.has(a.community || ""));
    if (cityFilter)           list = list.filter((a) => (a.city || "").includes(cityFilter));
    if (boardingFilter.size)  list = list.filter((a) => boardingFilter.has(a.boarding || ""));
    if (query.trim().length >= 1) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (a) =>
          (a.lastName || "").toLowerCase().includes(q) ||
          (a.firstName || "").toLowerCase().includes(q) ||
          (a.passportOrId || "").includes(q)
      );
    }
    const cmp = (a: string, b: string) => a.localeCompare(b, "he", { sensitivity: "base" });
    list = [...list].sort((a, b) => {
      if (sortBy === "lastNameAsc")  return cmp(a.lastName || "", b.lastName || "");
      if (sortBy === "classNameAsc") return cmp(a.className || "", b.className || "");
      const cc = cmp(a.className || "", b.className || "");
      return cc !== 0 ? cc : cmp(a.lastName || "", b.lastName || "");
    });
    return list;
  }, [localAlumni, query, lastNameFilter, firstNameFilter, classFilter, communityFilter, cityFilter, boardingFilter, sortBy]);

  // ── stats ──
  const stats = useMemo(() => {
    const total = localAlumni.length;
    const classes = new Set(localAlumni.map((a) => a.className).filter(Boolean));
    const communities = new Set(localAlumni.map((a) => a.community).filter(Boolean));
    return { total, classes: classes.size, communities: communities.size };
  }, [localAlumni]);

  const lastNameOptions  = useMemo(() => [...new Set(localAlumni.map((a) => a.lastName ).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [localAlumni]);
  const firstNameOptions = useMemo(() => [...new Set(localAlumni.map((a) => a.firstName).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [localAlumni]);
  const classOptions     = useMemo(() => [...new Set(localAlumni.map((a) => a.className).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [localAlumni]);
  const communityOptions = useMemo(() => [...new Set(localAlumni.map((a) => a.community).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [localAlumni]);
  const cityOptions      = useMemo(() => [...new Set(localAlumni.map((a) => a.city     ).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [localAlumni]);
  const boardingOptions  = useMemo(() => [...new Set(localAlumni.map((a) => a.boarding ).filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")), [localAlumni]);

  function toggleSet(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set); next.has(val) ? next.delete(val) : next.add(val); setFn(next);
  }

  const activeFilters =
    [lastNameFilter, firstNameFilter, cityFilter].filter(Boolean).length +
    classFilter.size + communityFilter.size + boardingFilter.size;

  function resetFilters() {
    setQuery(""); setLastNameFilter(""); setFirstNameFilter("");
    setClassFilter(new Set()); setCommunityFilter(new Set());
    setCityFilter(""); setBoardingFilter(new Set());
  }

  function handleExportToExcel() {
    const exportCols: ExportColDef[] = ALUMNI_COLUMNS
      .filter((c) => selectedExportFields.has(c.key))
      .map((c) => ({
        key: c.key,
        label: c.label,
        type: c.key === 'graduatedAt' || c.key === 'gregorianDate' ? 'date' : undefined,
      }));
    exportToExcel(
      displayed as unknown as Record<string, unknown>[],
      exportCols,
      'בוגרים',
      `רשימת_בוגרים_${todayStr()}.xlsx`,
    );
    setShowExportModal(false);
  }

  return (
    <motion.div
      className="al-page with-navbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="al-shell">

        {/* ── Header ── */}
        <div className="al-header">
          <h1 className="al-title">בוגרים</h1>
          <p className="al-subtitle">ניהול ועריכה של נתוני הבוגרים</p>
        </div>

        {/* ── Stats row ── */}
        {!loading && !error && (
          <div className="al-stats-row">
            <StatCard icon={<Users size={18} />}    value={stats.total}       label="סה״כ בוגרים" />
            <StatCard icon={<BookOpen size={18} />} value={stats.classes}     label="שיעורים"      />
            <StatCard icon={<MapPin size={18} />}   value={stats.communities} label="קהילות"       />
          </div>
        )}

        {/* ── Toolbar ── */}
        {!loading && !error && (
          <div className="al-toolbar">
            <div className="al-toolbar-row">
              <input
                className="al-search"
                placeholder="חיפוש לפי שם או ת״ז..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="al-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              >
                <option value="lastNameAsc">מיון: שם משפחה א-ת</option>
                <option value="classNameAsc">מיון: שיעור</option>
                <option value="classThenName">מיון: שיעור + משפחה</option>
              </select>
              <span className="al-count">
                מציג <strong>{displayed.length}</strong> מתוך {localAlumni.length}
              </span>
              {(activeFilters > 0 || query) && (
                <button className="al-reset-btn" onClick={resetFilters}>
                  ✕ נקה סינון {activeFilters > 0 && `(${activeFilters})`}
                </button>
              )}
              <button className="al-export-btn" onClick={() => setShowExportModal(true)}>
                <Download size={15} /> ייצוא
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
                <button className="export-modal-btn" onClick={() => setSelectedExportFields(new Set(ALUMNI_COLUMNS.map((c) => c.key)))}>בחר הכל</button>
                <button className="export-modal-btn" onClick={() => setSelectedExportFields(new Set())}>נקה הכל</button>
              </div>
              <div className="export-fields-grid">
                {ALUMNI_COLUMNS.map((c) => (
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
                <button className="al-export-btn" onClick={handleExportToExcel} disabled={selectedExportFields.size === 0}>
                  <Download size={15} /> ייצוא ({selectedExportFields.size} שדות)
                </button>
                <button className="export-modal-cancel" onClick={() => setShowExportModal(false)}>בטל</button>
              </div>
            </div>
          </div>
        )}

        {loading && <p className="search-state">טוען נתונים...</p>}
        {error   && <p className="search-error">{error}</p>}

        {/* ── Table ── */}
        {!loading && !error && (
          <div className="al-table-card">
            <div className="al-table-scroll">
              <table className="al-table">
                <thead>
                  <tr>
                    <th className="al-th-row-num">#</th>
                    {ALUMNI_COLUMNS.map((col) => (
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
                    <th className="al-th-link">כרטיס</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {displayed.map((alumni, idx) => (
                      <tr
                        key={alumni.id}
                        className="al-row"
                        style={{ animationDelay: `${Math.min(idx, 30) * 25}ms` }}
                      >
                        <td className="al-td-num">{idx + 1}</td>
                        {ALUMNI_COLUMNS.map((col) => (
                          <td key={col.key} className="al-td">
                            <EditableCell
                              alumni={alumni}
                              col={col}
                              onSaved={handleSaved}
                            />
                          </td>
                        ))}
                        <td className="al-td-link">
                          <button
                            className="al-card-btn"
                            onClick={() => navigate(`/alumni/${alumni.passportOrId || alumni.id}`)}
                            title="פתח כרטיס"
                          >
                            ←
                          </button>
                        </td>
                      </tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {displayed.length === 0 && (
                <p className="al-empty">לא נמצאו בוגרים</p>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
