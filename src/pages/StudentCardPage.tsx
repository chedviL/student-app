import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { getStudents } from "../api/studentsApi";
import type { Student } from "../types/student";

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

export default function StudentCardPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function copyPhone(phone: string) {
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    async function loadStudents() {
      try {
        setLoading(true);
        setError("");
        const data = await getStudents();
        setAllStudents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "אירעה שגיאה בטעינת הנתונים");
      } finally {
        setLoading(false);
      }
    }

    loadStudents();
  }, []);

  const student = useMemo(() => {
    return (
      allStudents.find(
        (s) => String(s.passportOrId || s.id || "") === String(studentId || "")
      ) || null
    );
  }, [allStudents, studentId]);

  console.log("Student data:", student);

  if (loading) {
    return (
      <div className="search-page">
        <div className="search-shell">
          <p className="search-state">טוען כרטיס תלמיד...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-page">
        <div className="search-shell">
          <p className="search-error">{error}</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            חזרה
          </button>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="search-page">
        <div className="search-shell">
          <p className="search-state">התלמיד לא נמצא</p>
          <button className="back-button" onClick={() => navigate(-1)}>
            חזרה לחיפוש
          </button>
        </div>
      </div>
    );
  }

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
        <motion.header className="page-header" variants={itemVariants}>
        </motion.header>

        <motion.section className="student-profile-card" variants={itemVariants}>
          <div className="student-profile-hero">
            <div className="student-photo-placeholder" />

            <div className="student-profile-main">
              <h2 className="student-profile-name">
                {student.lastName || "-"} {student.firstName || ""}
              </h2>

              <div className="student-profile-secondary">
                <span>ת"ז: {student.passportOrId || "-"}</span>
                <span className="student-profile-dot">•</span>
                <span>שיעור: {student.className || "-"}</span>
              </div>
            </div>
          </div>

          <motion.div className="student-profile-grid" variants={containerVariants}>
            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">שם האב</span>
              <span className="profile-value">{student.fatherName || "-"}</span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">שם האם</span>
              <span className="profile-value">{student.motherName || "-"}</span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">טלפון אב</span>
              <span
                className="profile-value phone-copy"
                onClick={() => student.fatherPhone && copyPhone(student.fatherPhone)}
                title="לחץ להעתקה"
              >
                {copied ? "✔ הועתק!" : (student.fatherPhone || "-")}
              </span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">טלפון אם</span>
              <span className="profile-value">{student.motherPhone || "-"}</span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">טלפון בית</span>
              <span className="profile-value">{student.homePhone || "-"}</span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">כתובת</span>
              <span className="profile-value">
                {[student.street, student.city].filter(Boolean).join(", ") || "-"}
              </span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">מייל</span>
              <span className="profile-value">
                {student.email
                  ? <a href={`https://mail.google.com/mail/?view=cm&to=${student.email}`} target="_blank" rel="noreferrer">{student.email}</a>
                  : "-"}
              </span>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">גיל</span>
              <span className="profile-value">{student.age || "-"}</span>
            </motion.div>

           <motion.div className="profile-item" variants={itemVariants}>
  <span className="profile-label">חינוך / דתות</span>
  <div className="education-row">
    <span className="edu-badge">
      {student.educationType && <span className="check-mark">✔</span>} חינוך
    </span>
    <span className="edu-badge">
      {student.religionStudies && <span className="check-mark">✔</span>} דתות
    </span>
  </div>
</motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">מצב שכ"ל</span>
              <span className="tuition-badge tuition-neutral">טרם עודכן</span>
            </motion.div>

            <motion.div className="profile-item profile-item-action" variants={itemVariants}>
              <button className="back-button" onClick={() => navigate(-1)}>
                חזרה לחיפוש
              </button>
            </motion.div>

            <motion.div className="profile-item" variants={itemVariants}>
              <span className="profile-label">הערה</span>
              <span className="profile-value">{student.paymentStatusNotes || "אין הערה כרגע"}</span>
            </motion.div>

          </motion.div>
        </motion.section>
      </motion.div>
    </motion.div>
  );
}