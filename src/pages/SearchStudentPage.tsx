import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { getStudents } from "../api/studentsApi";
import type { Student } from "../types/student";
import logo from "../assets/logo.png";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import "./SearchStudentPage.css";

function normalize(text: string | undefined) {
  return (text || "")
    .toLowerCase()
    .replace(/['״׳]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDigits(text: string | undefined) {
  return (text || "").replace(/\D/g, "");
}

function splitWords(text: string | undefined) {
  return normalize(text).split(" ").filter(Boolean);
}

function startsWithAnyWord(text: string | undefined, term: string) {
  const words = splitWords(text);
  return words.some((word) => word.startsWith(term));
}

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
      duration: 0.4,
    },
  },
};

export default function SearchStudentPage() {
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
const navigate = useNavigate();
  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        setError("");
        const data = await getStudents();
        setAllStudents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה");
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  const filteredStudents = useMemo(() => {
    const normalizedQuery = normalize(query);
    const numericQuery = normalizeDigits(query);

    if (normalizedQuery.length < 2 && numericQuery.length < 2) {
      return [];
    }

    const textTerms = normalizedQuery
      .split(" ")
      .filter(Boolean)
      .filter((term) => !/^\d+$/.test(term));

    return allStudents.filter((student) => {
      const firstName = student.firstName || "";
      const lastName = student.lastName || "";
      const passportOrId = student.passportOrId || "";
      const normalizedPassportOrId = normalizeDigits(passportOrId);

      if (numericQuery.length >= 2 && textTerms.length === 0) {
        return normalizedPassportOrId.includes(numericQuery);
      }

      const allTextTermsMatch = textTerms.every((term) => {
        return (
          startsWithAnyWord(firstName, term) ||
          startsWithAnyWord(lastName, term)
        );
      });

      if (!allTextTermsMatch) {
        return false;
      }

      if (numericQuery.length >= 2) {
        return normalizedPassportOrId.includes(numericQuery);
      }

      return true;
    });
  }, [query, allStudents]);

  return (
    <motion.div
      className="search-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <motion.div
        className="search-shell"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.header className="search-header" variants={itemVariants}>
          <button className="home-button" onClick={() => navigate("/")}>
            לדף הבית
          </button>
          <img src={logo} alt="לוגו הישיבה" className="search-logo" />
        </motion.header>

        <motion.section className="search-toolbar" variants={itemVariants}>
          <div className="search-input-wrap">
            <Search size={20} className="search-icon" />
            <input
              className="search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="הקלידו שם, משפחה או ת״ז"
            />
          </div>
        </motion.section>

        {!loading &&
          !error &&
          (normalize(query).length >= 2 || normalizeDigits(query).length >= 2) && (
            <motion.div className="results-summary" variants={itemVariants}>
              נמצאו <span>{filteredStudents.length}</span> תוצאות
            </motion.div>
          )}

        {loading && (
          <motion.p className="search-state" variants={itemVariants}>
            טוען תלמידים...
          </motion.p>
        )}
        {error && (
          <motion.p className="search-error" variants={itemVariants}>
            {error}
          </motion.p>
        )}

        {!loading &&
          !error &&
          query.trim().length > 0 &&
          normalize(query).length < 2 &&
          normalizeDigits(query).length < 2 && (
            <motion.p className="search-state" variants={itemVariants}>
              הקלידי לפחות 2 תווים לחיפוש
            </motion.p>
          )}

        {!loading &&
          !error &&
          (normalize(query).length >= 2 || normalizeDigits(query).length >= 2) &&
          filteredStudents.length === 0 && (
            <motion.p className="search-state" variants={itemVariants}>
              לא נמצאו תוצאות
            </motion.p>
          )}

        {!loading && !error && filteredStudents.length > 0 && (
          <motion.div className="students-list" variants={containerVariants}>
            {filteredStudents.map((student, index) => (
              <motion.article
                className="student-row-card clickable-student-row"
                key={student.passportOrId || index}
                onClick={() => navigate(`/student/${student.passportOrId}`)}
                variants={itemVariants}
              >
                <div className="student-row-main">
                  <h3 className="student-row-name">
                    {student.lastName || "-"} {student.firstName || ""}
                  </h3>

                  <div className="student-row-meta">
                    <span className="student-row-meta-item">
                      <span className="meta-label">מס זהות:</span>
                      <span className="meta-value meta-id">
                        {student.passportOrId || "-"}
                      </span>
                    </span>

                    <span className="student-row-separator">•</span>

                    <span className="student-row-meta-item">
                      <span className="meta-label">שיעור:</span>
                      <span className="meta-value">{student.className || "-"}</span>
                    </span>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}