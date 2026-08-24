import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  Pencil,
  X,
  Check,
  Loader2,
  Phone,
  Mail,
  MapPin,
  User,
  Users,
  Calendar,
  ArrowRight,
  BookOpen,
  Wallet,
  CreditCard,
} from "lucide-react";
import { useAlumni } from "../context/AlumniContext";
import { updateAlumnus } from "../api/alumniApi";
import type { Alumni } from "../types/student";
import { formatDate } from "../utils/dateHelpers";

type FieldDef = {
  key: keyof Alumni;
  label: string;
  type?: "text" | "email" | "tel";
  icon: React.ReactNode;
};

const CONTACT_FIELDS: FieldDef[] = [
  {
    key: "alumniPhone",
    label: "טלפון אישי",
    type: "tel",
    icon: <Phone size={14} />,
  },
  {
    key: "email",
    label: "מייל",
    type: "email",
    icon: <Mail size={14} />,
  },
  {
    key: "city",
    label: "עיר",
    icon: <MapPin size={14} />,
  },
  {
    key: "street",
    label: "רחוב",
    icon: <MapPin size={14} />,
  },
  {
    key: "community",
    label: "קהילה",
    icon: <Users size={14} />,
  },
];

const TUITION_FIELDS: FieldDef[] = [
  {
    key: "tuition",
    label: "שכר לימוד",
    icon: <Wallet size={14} />,
  },
  {
    key: "tuitionRank",
    label: "דירוג שכר לימוד",
    icon: <Wallet size={14} />,
  },
  {
    key: "paymentStatusNotes",
    label: "מצב שכ״ל",
    icon: <CreditCard size={14} />,
  },
  {
    key: "paymentMethod",
    label: "אמצעי תשלום",
    icon: <CreditCard size={14} />,
  },
  {
    key: "tuitionStartDate",
    label: "תאריך תחילת שכ״ל",
    icon: <Calendar size={14} />,
  },
  {
    key: "dueDateNote",
    label: "הערת מועד תשלום",
    icon: <Calendar size={14} />,
  },
  {
    key: "credit",
    label: "אשראי",
    icon: <CreditCard size={14} />,
  },
  {
    key: "bankTransfer",
    label: "העברה בנקאית",
    icon: <CreditCard size={14} />,
  },
  {
    key: "finish241023",
    label: "סיום 24/10/23",
    icon: <Calendar size={14} />,
  },
  {
    key: "endOfYear",
    label: "סוף שנה",
    icon: <Calendar size={14} />,
  },
];

const pageStyle: React.CSSProperties = {
  background:
    "radial-gradient(circle at top center, rgba(148,163,184,0.1), transparent 40%), linear-gradient(180deg, #1e2530 0%, #161c26 100%)",
  minHeight: "100vh",
  padding: "32px 16px 60px",
  direction: "rtl",
};

const backBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.25)",
  background: "rgba(30,37,48,0.8)",
  color: "#94a3b8",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

const editBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 18px",
  borderRadius: 10,
  border: "1px solid rgba(148,163,184,0.3)",
  background: "linear-gradient(180deg, #334155 0%, #1e293b 100%)",
  color: "#cbd5e1",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const saveBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 18px",
  borderRadius: 10,
  border: "1px solid rgba(100,180,100,0.4)",
  background: "linear-gradient(180deg, #1e3a2d, #2d6a4a)",
  color: "#d1fae5",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 18px",
  borderRadius: 10,
  border: "1px solid rgba(180,60,60,0.35)",
  background: "rgba(50,15,15,0.6)",
  color: "#fca5a5",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const heroCardStyle: React.CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(45,55,72,0.9) 0%, rgba(30,37,48,0.95) 100%)",
  border: "1px solid rgba(148,163,184,0.2)",
  borderRadius: 20,
  padding: "28px",
  display: "flex",
  alignItems: "center",
  gap: 24,
  marginBottom: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
};

const sectionCardStyle: React.CSSProperties = {
  background: "rgba(30,37,48,0.7)",
  border: "1px solid rgba(148,163,184,0.15)",
  borderRadius: 16,
  padding: "18px 20px",
  marginBottom: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "rgba(148,163,184,0.12)",
  border: "1px solid rgba(148,163,184,0.25)",
  color: "#94a3b8",
  borderRadius: 8,
  padding: "3px 10px",
  fontSize: 13,
  fontWeight: 700,
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.1, staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { y: 14, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.3 },
  },
};

export default function AlumniCardPage() {
  const { alumniId } = useParams();
  const navigate = useNavigate();
  const { alumni, loading, error, updateLocal } = useAlumni();

  const [copied, setCopied] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Partial<Alumni>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const alumnus = useMemo(
    () =>
      alumni.find(
        (a) =>
          String(a.passportOrId || a.id || "") ===
          String(alumniId || "")
      ) ?? null,
    [alumni, alumniId]
  );

  function copyPhone(phone: string, key: string) {
    navigator.clipboard.writeText(phone);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function enterEdit() {
    if (!alumnus) return;
    setDraft({ ...alumnus });
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
    if (!alumnus) return;

    setSaving(true);
    setSaveError("");

    try {
      const saved = await updateAlumnus(alumnus.id, draft);
      updateLocal(saved);
      setSaveSuccess(true);
      setEditMode(false);
      setDraft({});
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "שגיאה בשמירה"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        className="with-navbar"
      >
        <Loader2
          size={32}
          style={{
            color: "#64748b",
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
        }}
        className="with-navbar"
      >
        <p style={{ color: "#fca5a5", fontSize: 18 }}>{error}</p>
        <button
          onClick={() => navigate("/alumni")}
          style={backBtnStyle}
        >
          <ArrowRight size={15} />
          חזרה לבוגרים
        </button>
      </div>
    );
  }

  if (!alumnus) {
    return (
      <div
        style={{
          ...pageStyle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
        }}
        className="with-navbar"
      >
        <p style={{ color: "#cbd5e1", fontSize: 18 }}>
          הבוגר לא נמצא
        </p>
        <button
          onClick={() => navigate("/alumni")}
          style={backBtnStyle}
        >
          <ArrowRight size={15} />
          חזרה לבוגרים
        </button>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .ac-shell {
          max-width: 920px;
          margin: 0 auto;
        }

        .ac-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }

        .ac-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .ac-input {
          width: 100%;
          box-sizing: border-box;
          padding: 9px 11px;
          border-radius: 9px;
          border: 1px solid rgba(148,163,184,0.3);
          background: rgba(15,23,42,0.6);
          color: #e2e8f0;
          outline: none;
          font-family: inherit;
        }

        .ac-input:focus {
          border-color: rgba(148,163,184,0.6);
        }

        .ac-section-title {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #94a3b8;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 12px;
        }

        .ac-field-card {
          border: 1px solid rgba(148,163,184,0.12);
          border-radius: 10px;
          padding: 10px 12px;
          min-height: 58px;
          background: rgba(15,23,42,0.28);
        }

        .ac-field-label {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .ac-field-value {
          color: #e2e8f0;
          font-size: 14px;
          font-weight: 600;
        }

        .ac-field-empty {
          color: #475569;
          font-size: 14px;
        }

        .ac-phone {
          cursor: pointer;
        }

        .ac-email {
          text-decoration: none;
        }

        .ac-email:hover {
          text-decoration: underline;
        }

        @keyframes ac-spin {
          to { transform: rotate(360deg); }
        }

        .ac-spin {
          animation: ac-spin 1s linear infinite;
        }
      `}</style>

      <motion.div
        style={pageStyle}
        className="with-navbar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="ac-shell">
          <div className="ac-topbar">
            <button
              onClick={() => navigate("/alumni")}
              style={backBtnStyle}
            >
              <ArrowRight size={15} />
              חזרה
            </button>

            <div className="ac-actions">
              {!editMode ? (
                <button onClick={enterEdit} style={editBtnStyle}>
                  <Pencil size={15} />
                  ערוך
                </button>
              ) : (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    style={saveBtnStyle}
                  >
                    {saving ? (
                      <Loader2 size={15} className="ac-spin" />
                    ) : (
                      <Check size={15} />
                    )}
                    {saving ? "שומר..." : "שמור"}
                  </button>

                  <button
                    onClick={cancelEdit}
                    style={cancelBtnStyle}
                  >
                    <X size={15} />
                    בטל
                  </button>
                </>
              )}
            </div>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={itemVariants} style={heroCardStyle}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  background: "rgba(148,163,184,0.1)",
                  border: "2px solid rgba(148,163,184,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <User
                  size={28}
                  style={{ color: "rgba(148,163,184,0.6)" }}
                />
              </div>

              <div style={{ flex: 1 }}>
                {editMode ? (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <input
                      className="ac-input"
                      style={{ fontSize: 18, fontWeight: 700 }}
                      value={draft.lastName ?? ""}
                      placeholder="שם משפחה"
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          lastName: e.target.value,
                        }))
                      }
                    />

                    <input
                      className="ac-input"
                      style={{ fontSize: 18, fontWeight: 700 }}
                      value={draft.firstName ?? ""}
                      placeholder="שם פרטי"
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                ) : (
                  <h1
                    style={{
                      color: "#f1f5f9",
                      margin: "0 0 8px",
                      fontSize: 27,
                    }}
                  >
                    {alumnus.lastName} {alumnus.firstName}
                  </h1>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 7,
                  }}
                >
                  {alumnus.passportOrId && (
                    <span style={badgeStyle}>
                      <User size={12} />
                      {alumnus.passportOrId}
                    </span>
                  )}

                  {alumnus.className && (
                    <span style={badgeStyle}>
                      <BookOpen size={12} />
                      {alumnus.className}
                    </span>
                  )}

                  {alumnus.graduatedAt && (
                    <span style={badgeStyle}>
                      <Calendar size={12} />
                      {formatDate(alumnus.graduatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            <AnimatePresence>
              {(saveSuccess || saveError) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    margin: "12px 0",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: saveSuccess
                      ? "rgba(20,50,35,0.6)"
                      : "rgba(60,15,15,0.6)",
                    border: `1px solid ${
                      saveSuccess
                        ? "rgba(80,160,100,0.3)"
                        : "rgba(160,50,50,0.3)"
                    }`,
                    color: saveSuccess ? "#6ee7b7" : "#fca5a5",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {saveSuccess
                    ? "הנתונים נשמרו בהצלחה"
                    : saveError}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.div variants={itemVariants} style={sectionCardStyle}>
              <div className="ac-section-title">
                <Phone size={13} />
                פרטי קשר
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: 10,
                }}
              >
                {CONTACT_FIELDS.map((field) => {
                  const rawValue = alumnus[field.key];
                  const val =
                    rawValue == null ? "" : String(rawValue);

                  return (
                    <div key={field.key} className="ac-field-card">
                      <div className="ac-field-label">
                        {field.icon}
                        {field.label}
                      </div>

                      {editMode ? (
                        <input
                          className="ac-input"
                          type={field.type ?? "text"}
                          value={
                            draft[field.key] == null
                              ? ""
                              : String(draft[field.key])
                          }
                          placeholder={field.label}
                          dir={
                            field.type === "tel" ||
                            field.type === "email"
                              ? "ltr"
                              : undefined
                          }
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      ) : field.type === "tel" && val ? (
                        <span
                          className="ac-field-value ac-phone"
                          onClick={() =>
                            copyPhone(val, String(field.key))
                          }
                          title="לחץ להעתקה"
                          style={{
                            direction: "ltr",
                            unicodeBidi: "isolate",
                          }}
                        >
                          {copied === String(field.key)
                            ? "הועתק!"
                            : val}
                        </span>
                      ) : field.type === "email" && val ? (
                        <a
                          href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(
                            val
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ac-field-value ac-email"
                          style={{
                            direction: "ltr",
                            unicodeBidi: "isolate",
                          }}
                        >
                          {val}
                        </a>
                      ) : (
                        <span
                          className={
                            val
                              ? "ac-field-value"
                              : "ac-field-empty"
                          }
                        >
                          {val || "—"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={itemVariants} style={sectionCardStyle}>
              <div className="ac-section-title">
                <Wallet size={13} />
                פרטי שכר לימוד
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(190px, 1fr))",
                  gap: 10,
                }}
              >
                {TUITION_FIELDS.map((field) => {
                  const rawValue = alumnus[field.key];
                  const val =
                    rawValue == null ? "" : String(rawValue);

                  const isDateField =
                    field.key === "tuitionStartDate";

                  const displayValue =
                    isDateField && val
                      ? formatDate(val)
                      : val;

                  return (
                    <div key={field.key} className="ac-field-card">
                      <div className="ac-field-label">
                        {field.icon}
                        {field.label}
                      </div>

                      {editMode ? (
                        <input
                          className="ac-input"
                          type="text"
                          value={
                            draft[field.key] == null
                              ? ""
                              : String(draft[field.key])
                          }
                          placeholder={field.label}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              [field.key]: e.target.value,
                            }))
                          }
                        />
                      ) : (
                        <span
                          className={
                            displayValue
                              ? "ac-field-value"
                              : "ac-field-empty"
                          }
                        >
                          {displayValue || "—"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}