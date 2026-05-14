import { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "framer-motion";
import { getStudents } from "../api/studentsApi";
import type { Student } from "../types/student";
import "./SortedListsPage.css";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import * as XLSX from "xlsx";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.2, staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

type SortOption = "lastNameAsc" | "classNameAsc" | "classThenLastName";

type FilterInputProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
};

function FilterInput({ label, options, value, onChange }: FilterInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = options.filter(o => o.includes(value));

  return (
    <div className="filter-dropdown" ref={ref}>
      <button className={`filter-btn${value ? " filter-btn-active" : ""}`} onClick={() => setOpen(o => !o)}>
        {label} {value ? `"${value}"` : ""} ▾
      </button>
      {open && (
        <div className="filter-menu">
          <input
            autoFocus
            className="filter-search-input"
            placeholder={`חפש ${label}...`}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
          {value && (
            <button className="filter-clear" onClick={() => { onChange(""); setOpen(false); }}>נקה</button>
          )}
          {filtered.map(opt => (
            <div
              key={opt}
              className={`filter-option${value === opt ? " filter-option-selected" : ""}`}
              onClick={() => { onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type FilterDropdownProps = {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (val: string) => void;
  onClear: () => void;
};

function FilterDropdown({ label, options, selected, onChange, onClear }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="filter-dropdown" ref={ref}>
      <button className={`filter-btn${selected.size ? " filter-btn-active" : ""}`} onClick={() => setOpen(o => !o)}>
        {label} {selected.size ? `(${selected.size})` : ""} ▾
      </button>
      {open && (
        <div className="filter-menu">
          <button className="filter-clear" onClick={() => { onClear(); setOpen(false); }}>נקה הכל</button>
          {options.map(opt => (
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

const ALL_FIELDS: { key: keyof Student | string; label: string }[] = [
  { key: "lastName", label: "משפחה" },
  { key: "firstName", label: "שם" },
  { key: "className", label: "שיעור" },
  { key: "passportOrId", label: 'ת"ז' },
  { key: "fatherName", label: "שם האב" },
  { key: "motherName", label: "שם האם" },
  { key: "fatherPhone", label: "טלפון אב" },
  { key: "motherPhone", label: "טלפון אם" },
  { key: "homePhone", label: "טלפון בית" },
  { key: "city", label: "עיר" },
  { key: "street", label: "רחוב" },
  { key: "email", label: "מייל" },
  { key: "age", label: "גיל" },
  { key: "community", label: "קהילה" },
  { key: "tuition", label: 'שכ"ל' },
  { key: "tuitionRank", label: 'דירוג שכ"ל' },
  { key: "paymentMethod", label: "באמצעות" },
  { key: "paymentStatusNotes", label: "סטטוס/הערות" },
  { key: "credit", label: "אשראי" },
  { key: "bankTransfer", label: "בנקאי" },
  { key: "fax", label: "פקס" },
  { key: "contactPhone", label: "איש קשר טלפון" },
  { key: "contactAddress", label: "איש קשר כתובת" },
  { key: "hebrewDate", label: "תאריך עברי" },
  { key: "gregorianDate", label: "תאריך לועזי" },
];

export default function SortedListsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("lastNameAsc");
  const [cityFilter, setCityFilter] = useState("");
  const [firstNameFilter, setFirstNameFilter] = useState("");
  const [lastNameFilter, setLastNameFilter] = useState("");
  const [classFilter, setClassFilter] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(ALL_FIELDS.map(f => f.key))
  );
  const navigate = useNavigate();

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        setError("");
        const data = await getStudents();
        setStudents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה בטעינת הנתונים");
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, []);

  const firstNameOptions = useMemo(() =>
    [...new Set(students.map(s => s.firstName || "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")),
    [students]
  );
  const lastNameOptions = useMemo(() =>
    [...new Set(students.map(s => s.lastName || "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")),
    [students]
  );
  const classOptions = useMemo(() =>
    [...new Set(students.map(s => s.className || "").filter(Boolean))].sort((a, b) => a.localeCompare(b, "he")),
    [students]
  );

  const sortedStudents = useMemo(() => {
    const compareHebrew = (a: string, b: string) =>
      a.localeCompare(b, "he", { sensitivity: "base" });

    let filtered = [...students];

    if (cityFilter.trim()) {
      const normalizedCity = cityFilter.trim().toLowerCase();
      filtered = filtered.filter(s => (s.city || "").toLowerCase().includes(normalizedCity));
    }
    if (firstNameFilter.trim()) filtered = filtered.filter(s => (s.firstName || "").includes(firstNameFilter.trim()));
    if (lastNameFilter.trim()) filtered = filtered.filter(s => (s.lastName || "").includes(lastNameFilter.trim()));
    if (classFilter.size) filtered = filtered.filter(s => classFilter.has(s.className || ""));

    filtered.sort((a, b) => {
      const lastNameA = a.lastName || "";
      const lastNameB = b.lastName || "";
      const classA = a.className || "";
      const classB = b.className || "";

      if (sortBy === "lastNameAsc") return compareHebrew(lastNameA, lastNameB);
      if (sortBy === "classNameAsc") return compareHebrew(classA, classB);

      const classCompare = compareHebrew(classA, classB);
      if (classCompare !== 0) return classCompare;
      return compareHebrew(lastNameA, lastNameB);
    });

    return filtered;
  }, [students, sortBy, cityFilter, firstNameFilter, lastNameFilter, classFilter]);

  function toggleFilter(set: Set<string>, setFn: (s: Set<string>) => void, val: string) {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setFn(next);
  }

  function exportToExcel() {
    const fields = ALL_FIELDS.filter(f => selectedFields.has(f.key));
    const headers = fields.map(f => f.label);
    const rows = sortedStudents.map(s =>
      fields.map(f => String((s as unknown as Record<string, unknown>)[f.key] || ""))
    );

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h, i) => ({
      wch: Math.max(h.length + 2, ...rows.map(r => String(r[i] || "").length + 2))
    }));
    headers.forEach((_, i) => {
      const cell = XLSX.utils.encode_cell({ r: 0, c: i });
      if (ws[cell]) ws[cell].s = { font: { bold: true }, alignment: { horizontal: "center" } };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "תלמידים");
    wb.Workbook = { Views: [{ RTL: true }] };
    XLSX.writeFile(wb, `רשימת_תלמידים_${new Date().toLocaleDateString("he-IL").replace(/\//g, "-")}.xlsx`);
    setShowExportModal(false);
  }

  return (
    <motion.div
      className="lists-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="lists-shell"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.header className="lists-header" variants={itemVariants}>
          <img src={logo} alt="לוגו הישיבה" className="lists-logo-corner" />
          <h1 className="lists-title">רשימות תלמידים</h1>
          <p className="lists-subtitle">תצוגה מרוכזת של כלל התלמידים עם אפשרות מיון</p>
        </motion.header>

        <motion.section className="lists-toolbar" variants={itemVariants}>
          <div className="lists-toolbar-group">
            <label htmlFor="sortSelect" className="lists-label">מיון לפי</label>
            <select
              id="sortSelect"
              className="lists-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="lastNameAsc">שם משפחה - א עד ת</option>
              <option value="classNameAsc">שיעור</option>
            </select>
          </div>
          <div className="lists-toolbar-group">
            <label className="lists-label">סינון לפי עיר</label>
            <input
              type="text"
              className="lists-input"
              placeholder="הקלידו שם עיר לסינון"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            />
          </div>
          <div className="lists-count">
            סה״כ תלמידים: <span>{sortedStudents.length}</span>
          </div>
          <button className="export-btn" onClick={() => setShowExportModal(true)}>
            ⬇ ייצא לאקסל
          </button>
        </motion.section>

        {showExportModal && (
          <div className="export-modal-overlay" onClick={() => setShowExportModal(false)}>
            <div className="export-modal" onClick={e => e.stopPropagation()}>
              <h3 className="export-modal-title">בחר שדות לייצוא</h3>
              <div className="export-modal-actions">
                <button className="export-modal-btn" onClick={() => setSelectedFields(new Set(ALL_FIELDS.map(f => f.key)))}>בחר הכל</button>
                <button className="export-modal-btn" onClick={() => setSelectedFields(new Set())}>נקה הכל</button>
              </div>
              <div className="export-fields-grid">
                {ALL_FIELDS.map(f => (
                  <label key={f.key} className="export-field-option">
                    <input
                      type="checkbox"
                      checked={selectedFields.has(f.key)}
                      onChange={() => {
                        const next = new Set(selectedFields);
                        next.has(f.key) ? next.delete(f.key) : next.add(f.key);
                        setSelectedFields(next);
                      }}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
              <div className="export-modal-footer">
                <button className="export-btn" onClick={exportToExcel} disabled={selectedFields.size === 0}>
                  ⬇ ייצא ({selectedFields.size} שדות)
                </button>
                <button className="export-modal-cancel" onClick={() => setShowExportModal(false)}>בטל</button>
              </div>
            </div>
          </div>
        )}

        {loading && <motion.p className="lists-state" variants={itemVariants}>טוען נתונים...</motion.p>}
        {error && <motion.p className="lists-error" variants={itemVariants}>{error}</motion.p>}

        {!loading && !error && (
          <motion.section className="lists-table-card" variants={itemVariants}>
            <div className="lists-table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>
                      <FilterInput
                        label="משפחה"
                        options={lastNameOptions}
                        value={lastNameFilter}
                        onChange={setLastNameFilter}
                      />
                    </th>
                    <th>
                      <FilterInput
                        label="שם"
                        options={firstNameOptions}
                        value={firstNameFilter}
                        onChange={setFirstNameFilter}
                      />
                    </th>
                    <th>
                      <FilterDropdown
                        label="שיעור"
                        options={classOptions}
                        selected={classFilter}
                        onChange={v => toggleFilter(classFilter, setClassFilter, v)}
                        onClear={() => setClassFilter(new Set())}
                      />
                    </th>
                    <th>ת״ז</th>
                    <th>שם האב</th>
                    <th>שם האם</th>
                    <th>טלפון אב</th>
                    <th>טלפון אם</th>
                    <th>טלפון בית</th>
                    <th>עיר</th>
                    <th>רחוב</th>
                    <th>מייל</th>
                    <th>גיל</th>
                    <th>קהילה</th>
                    <th>שכ"ל</th>
                    <th>דירוג שכ"ל</th>
                    <th>באמצעות</th>
                    <th>סטטוס/הערות</th>
                    <th>אשראי</th>
                    <th>בנקאי</th>
                    <th>פקס</th>
                    <th>איש קשר טלפון</th>
                    <th>איש קשר כתובת</th>
                    <th>תאריך עברי</th>
                    <th>תאריך לועזי</th>
                  </tr>
                </thead>
                <motion.tbody variants={containerVariants}>
                  {sortedStudents.map((student, index) => (
                    <motion.tr
                      key={student.passportOrId || student.id || index}
                      className="clickable-row"
                      onClick={() => navigate(`/student/${student.passportOrId || student.id}`)}
                      variants={rowVariants}
                      whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                    >
                      <td>{student.lastName || "-"}</td>
                      <td>{student.firstName || "-"}</td>
                      <td>{student.className || "-"}</td>
                      <td className="id-cell">{student.passportOrId || "-"}</td>
                      <td>{student.fatherName || "-"}</td>
                      <td>{student.motherName || "-"}</td>
                      <td>{student.fatherPhone || "-"}</td>
                      <td>{student.motherPhone || "-"}</td>
                      <td>{student.homePhone || "-"}</td>
                      <td>{student.city || "-"}</td>
                      <td>{student.street || "-"}</td>
                      <td>{student.email || "-"}</td>
                      <td>{student.age || "-"}</td>
                      <td>{student.community || "-"}</td>
                      <td>{student.tuition || "-"}</td>
                      <td>{student.tuitionRank || "-"}</td>
                      <td>{student.paymentMethod || "-"}</td>
                      <td>{student.paymentStatusNotes || "-"}</td>
                      <td>{student.credit || "-"}</td>
                      <td>{student.bankTransfer || "-"}</td>
                      <td>{student.fax || "-"}</td>
                      <td>{student.contactPhone || "-"}</td>
                      <td>{student.contactAddress || "-"}</td>
                      <td>{student.hebrewDate || "-"}</td>
                      <td>{student.gregorianDate || "-"}</td>
                    </motion.tr>
                  ))}
                </motion.tbody>
              </table>
            </div>
          </motion.section>
        )}
      </motion.div>
    </motion.div>
  );
}
