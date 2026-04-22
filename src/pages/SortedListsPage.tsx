import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getStudents } from "../api/studentsApi";
import type { Student } from "../types/student";
import "./SortedListsPage.css";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
    },
  },
};

type SortOption =
  | "lastNameAsc"
  | "classNameAsc"
  | "classThenLastName";

export default function SortedListsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("lastNameAsc");
const [cityFilter, setCityFilter] = useState("");
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

  const sortedStudents = useMemo(() => {
  const compareHebrew = (a: string, b: string) =>
    a.localeCompare(b, "he", { sensitivity: "base" });

  let filtered = [...students];

  /* סינון לפי עיר */

  if (cityFilter.trim()) {
    const normalizedCity = cityFilter.trim().toLowerCase();

    filtered = filtered.filter((student) =>
      (student.city || "")
        .toLowerCase()
        .includes(normalizedCity)
    );
  }

  /* מיון */

  filtered.sort((a, b) => {
    const lastNameA = a.lastName || "";
    const lastNameB = b.lastName || "";
    const classA = a.className || "";
    const classB = b.className || "";

    if (sortBy === "lastNameAsc") {
      return compareHebrew(lastNameA, lastNameB);
    }

    if (sortBy === "classNameAsc") {
      return compareHebrew(classA, classB);
    }

    const classCompare = compareHebrew(classA, classB);

    if (classCompare !== 0) return classCompare;

    return compareHebrew(lastNameA, lastNameB);
  });

  return filtered;
}, [students, sortBy, cityFilter]);

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
          <p className="lists-subtitle">
            תצוגה מרוכזת של כלל התלמידים עם אפשרות מיון
          </p>
        </motion.header>

        <motion.section className="lists-toolbar" variants={itemVariants}>
          <div className="lists-toolbar-group">
            <label htmlFor="sortSelect" className="lists-label">
              מיון לפי
            </label>

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
  <label className="lists-label">
    סינון לפי עיר
  </label>

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
        </motion.section>

        {loading && <motion.p className="lists-state" variants={itemVariants}>טוען נתונים...</motion.p>}
        {error && <motion.p className="lists-error" variants={itemVariants}>{error}</motion.p>}

        {!loading && !error && (
          <motion.section className="lists-table-card" variants={itemVariants}>
            <div className="lists-table-wrapper">
              <table className="students-table">
                <thead>
                  <tr>
                    <th>משפחה</th>
                    <th>שם</th>
                    <th>שיעור</th>
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