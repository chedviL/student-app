import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  Pencil, X, Check, Loader2, Phone, Mail, MapPin,
  User, Users, Calendar, ArrowRight, BookOpen, MessageSquare,
} from "lucide-react";
import { useAlumni } from "../context/AlumniContext";
import { updateAlumnus } from "../api/alumniApi";
import type { Alumni } from "../types/student";

function fmtDate(val: string | undefined): string {
  if (!val) return "";
  if (val.includes(".")) return val;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const m2 = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2].padStart(2, "0")}.${m2[1].padStart(2, "0")}.${m2[3]}`;
  const n = Number(val);
  if (!isNaN(n) && n > 1000 && n < 100000) {
    const d = new Date(new Date(1899, 11, 30).getTime() + n * 86400000);
    return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  }
  return val;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.1, staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { y: 14, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.3 } },
};

type FieldDef = {
  key: keyof Alumni;
  label: string;
  type?: "text" | "email" | "tel";
  icon: React.ReactNode;
  section: "contact" | "family" | "info";
};

const FIELDS: FieldDef[] = [
  { key: "alumniPhone",        label: "טלפון בוגר",  type: "tel",   icon: <Phone size={14}/>,         section: "contact" },
  { key: "email",              label: "מייל",         type: "email", icon: <Mail size={14}/>,          section: "contact" },
  { key: "city",               label: "עיר",                         icon: <MapPin size={14}/>,        section: "contact" },
  { key: "street",             label: "רחוב",                        icon: <MapPin size={14}/>,        section: "contact" },
  { key: "fatherName",         label: "שם האב",                      icon: <User size={14}/>,          section: "family"  },
  { key: "fatherPhone",        label: "טלפון אב",    type: "tel",   icon: <Phone size={14}/>,         section: "family"  },
  { key: "motherName",         label: "שם האם",                      icon: <User size={14}/>,          section: "family"  },
  { key: "motherPhone",        label: "טלפון אם",    type: "tel",   icon: <Phone size={14}/>,         section: "family"  },
  { key: "homePhone",          label: "טלפון בית",   type: "tel",   icon: <Phone size={14}/>,         section: "family"  },
  { key: "age",                label: "גיל",                         icon: <Calendar size={14}/>,      section: "info"    },
  { key: "community",          label: "קהילה",                       icon: <Users size={14}/>,         section: "info"    },
  { key: "paymentStatusNotes", label: "הערה",                        icon: <MessageSquare size={14}/>, section: "info"    },
];

const SECTIONS: { id: "contact" | "family" | "info"; label: string; icon: React.ReactNode }[] = [
  { id: "contact", label: "פרטי קשר",   icon: <Phone size={15}/>    },
  { id: "family",  label: "משפחה",       icon: <Users size={15}/>    },
  { id: "info",    label: "מידע נוסף",   icon: <BookOpen size={15}/> },
];

export default function AlumniCardPage() {
  const { alumniId } = useParams();
  const navigate = useNavigate();
  const { alumni, loading, error, updateLocal } = useAlumni();

  const [copied, setCopied]           = useState<string | null>(null);
  const [editMode, setEditMode]       = useState(false);
  const [draft, setDraft]             = useState<Partial<Alumni>>({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const alumnus = useMemo(
    () => alumni.find((a) => String(a.passportOrId || a.id || "") === String(alumniId || "")) ?? null,
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

  function cancelEdit() { setEditMode(false); setDraft({}); setSaveError(""); }

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
      setSaveError(err instanceof Error ? err.message : "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  const pageStyle: React.CSSProperties = {
    background: "radial-gradient(circle at top center, rgba(200,134,63,0.14), transparent 40%), linear-gradient(180deg, #2c1f0e 0%, #1a1005 100%)",
    minHeight: "100vh",
    padding: "32px 16px 60px",
    direction: "rtl",
  };

  if (loading) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }} className="with-navbar">
      <Loader2 size={32} style={{ color: "#c8863f", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (error) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }} className="with-navbar">
      <p style={{ color: "#ffaaaa", fontSize: 18 }}>{error}</p>
      <button onClick={() => navigate("/alumni")} style={backBtnStyle}>חזרה לבוגרים</button>
    </div>
  );

  if (!alumnus) return (
    <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }} className="with-navbar">
      <p style={{ color: "#f2d98a", fontSize: 18 }}>הבוגר לא נמצא</p>
      <button onClick={() => navigate("/alumni")} style={backBtnStyle}>חזרה לבוגרים</button>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ac-spin { animation: spin 1s linear infinite; }
        .ac-field-card { background: rgba(52,36,16,0.7); border: 1px solid rgba(200,134,63,0.15); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; transition: border-color 0.2s, background 0.2s; }
        .ac-field-card:hover { border-color: rgba(200,134,63,0.3); background: rgba(52,36,16,0.95); }
        .ac-field-label { display: flex; align-items: center; gap: 5px; color: #b08848; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; }
        .ac-field-value { color: #f0e0b0; font-size: 15px; font-weight: 500; }
        .ac-field-empty { color: rgba(200,134,63,0.3); font-size: 14px; }
        .ac-phone { cursor: pointer; transition: color 0.15s; }
        .ac-phone:hover { color: #f2d98a; }
        .ac-email { color: #c8a060; text-decoration: none; transition: color 0.15s; }
        .ac-email:hover { color: #f2d98a; }
        .ac-section-title { display: flex; align-items: center; gap: 7px; color: #c8863f; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(200,134,63,0.15); }
        .ac-input { background: rgba(30,18,6,0.95); border: 1.5px solid rgba(200,134,63,0.35); color: #f0e0b0; border-radius: 8px; padding: 7px 11px; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s; }
        .ac-input:focus { border-color: #c8863f; box-shadow: 0 0 0 3px rgba(200,134,63,0.15); }
        .ac-input::placeholder { color: rgba(200,134,63,0.35); }
      `}</style>

      <motion.div
        style={pageStyle}
        className="with-navbar"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto" }}>

          {/* ── Back + actions bar ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <button onClick={() => navigate("/alumni")} style={backBtnStyle}>
              <ArrowRight size={15} /> חזרה לבוגרים
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {!editMode ? (
                <button onClick={enterEdit} style={editBtnStyle}>
                  <Pencil size={15} /> ערוך
                </button>
              ) : (
                <>
                  <button onClick={saveEdit} disabled={saving} style={saveBtnStyle}>
                    {saving ? <Loader2 size={15} className="ac-spin" /> : <Check size={15} />}
                    {saving ? "שומר..." : "שמור"}
                  </button>
                  <button onClick={cancelEdit} style={cancelBtnStyle}>
                    <X size={15} /> בטל
                  </button>
                </>
              )}
            </div>
          </div>

          <motion.div variants={containerVariants} initial="hidden" animate="visible">

            {/* ── Hero card ── */}
            <motion.div variants={itemVariants} style={heroCardStyle}>
              <div style={{
                width: 80, height: 80, borderRadius: "50%",
                background: "linear-gradient(135deg, rgba(200,134,63,0.25), rgba(200,134,63,0.08))",
                border: "2px solid rgba(200,134,63,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <User size={34} style={{ color: "rgba(200,134,63,0.7)" }} />
              </div>

              <div style={{ flex: 1 }}>
                {editMode ? (
                  <div style={{ display: "flex", gap: 8, flexDirection: "row-reverse", marginBottom: 8 }}>
                    <input className="ac-input" style={{ fontSize: 18, fontWeight: 700 }}
                      value={draft.lastName ?? ""} placeholder="שם משפחה"
                      onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} />
                    <input className="ac-input" style={{ fontSize: 18, fontWeight: 700 }}
                      value={draft.firstName ?? ""} placeholder="שם פרטי"
                      onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} />
                  </div>
                ) : (
                  <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 900, color: "#f2d98a", textShadow: "0 2px 12px rgba(200,134,63,0.2)" }}>
                    {alumnus.lastName || ""} {alumnus.firstName || ""}
                  </h1>
                )}

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {editMode ? (
                    <input className="ac-input" style={{ maxWidth: 160 }}
                      value={draft.className ?? ""} placeholder="שיעור"
                      onChange={(e) => setDraft((d) => ({ ...d, className: e.target.value }))} />
                  ) : alumnus.className ? (
                    <span style={badgeStyle}><BookOpen size={12} /> {alumnus.className}</span>
                  ) : null}

                  {alumnus.passportOrId && (
                    <span style={{ ...badgeStyle, background: "rgba(200,134,63,0.1)", color: "#b08848" }}>
                      ת"ז: {alumnus.passportOrId}
                    </span>
                  )}

                  {alumnus.graduatedAt && (
                    <span style={{ ...badgeStyle, background: "rgba(200,134,63,0.1)", color: "#b08848" }}>
                      <Calendar size={12} /> יציאה: {fmtDate(alumnus.graduatedAt)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── Feedback ── */}
            <AnimatePresence>
              {(saveSuccess || saveError) && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
                  style={{
                    margin: "12px 0",
                    padding: "10px 16px",
                    borderRadius: 10,
                    background: saveSuccess ? "rgba(40,80,40,0.5)" : "rgba(80,20,20,0.5)",
                    border: `1px solid ${saveSuccess ? "rgba(100,180,100,0.3)" : "rgba(180,60,60,0.3)"}`,
                    color: saveSuccess ? "#6dbe6d" : "#ffaaaa",
                    fontWeight: 700, fontSize: 14,
                  }}
                >
                  {saveSuccess ? "✔ הנתונים נשמרו בהצלחה" : `✖ ${saveError}`}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Sections ── */}
            {SECTIONS.map((section) => {
              const fields = FIELDS.filter((f) => f.section === section.id);
              return (
                <motion.div key={section.id} variants={itemVariants} style={sectionCardStyle}>
                  <div className="ac-section-title">
                    {section.icon} {section.label}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                    {fields.map((field) => {
                      const val = alumnus[field.key] as string | undefined;
                      return (
                        <div key={field.key} className="ac-field-card">
                          <div className="ac-field-label">
                            {field.icon} {field.label}
                          </div>
                          {editMode ? (
                            <input
                              className="ac-input"
                              type={field.type ?? "text"}
                              value={(draft[field.key] as string) ?? ""}
                              placeholder={field.label}
                              dir={field.type === "tel" || field.type === "email" ? "ltr" : undefined}
                              onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
                            />
                          ) : field.type === "tel" && val ? (
                            <span className="ac-field-value ac-phone" onClick={() => copyPhone(val, field.key)} title="לחץ להעתקה" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                              {copied === field.key ? "✔ הועתק!" : val}
                            </span>
                          ) : field.type === "email" && val ? (
                            <a href={`https://mail.google.com/mail/?view=cm&to=${val}`} target="_blank" rel="noreferrer" className="ac-field-value ac-email" style={{ direction: "ltr", unicodeBidi: "isolate" }}>
                              {val}
                            </a>
                          ) : (
                            <span className={val ? "ac-field-value" : "ac-field-empty"}>{val || "—"}</span>
                          )}
                        </div>
                      );
                    })}

                    {/* תאריך לידה — בסקשן info */}
                    {section.id === "info" && (
                      <div className="ac-field-card">
                        <div className="ac-field-label"><Calendar size={14} /> תאריך לידה</div>
                        {editMode ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <input className="ac-input" value={draft.hebrewDate ?? ""} placeholder="עברי"
                              onChange={(e) => setDraft((d) => ({ ...d, hebrewDate: e.target.value }))} />
                            <input className="ac-input" value={draft.gregorianDate ?? ""} placeholder="לועזי"
                              onChange={(e) => setDraft((d) => ({ ...d, gregorianDate: e.target.value }))} />
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {alumnus.hebrewDate && <span className="ac-field-value">{alumnus.hebrewDate}</span>}
                            {alumnus.gregorianDate && <span className="ac-field-value" style={{ direction: "ltr", unicodeBidi: "isolate", fontSize: 14 }}>{fmtDate(alumnus.gregorianDate)}</span>}
                            {!alumnus.hebrewDate && !alumnus.gregorianDate && <span className="ac-field-empty">—</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

          </motion.div>
        </div>
      </motion.div>
    </>
  );
}

// ── shared button styles ──────────────────────────────────────────────────────

const backBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 16px", borderRadius: 10,
  border: "1px solid rgba(200,134,63,0.3)",
  background: "rgba(52,36,16,0.7)",
  color: "#c8a060", fontSize: 14, fontWeight: 700, cursor: "pointer",
  transition: "background 0.2s",
};

const editBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 18px", borderRadius: 10,
  border: "1px solid rgba(200,134,63,0.4)",
  background: "linear-gradient(180deg, #6a4418 0%, #4a2e0a 100%)",
  color: "#f2d98a", fontSize: 14, fontWeight: 800, cursor: "pointer",
  boxShadow: "inset 0 1px 0 rgba(255,220,140,0.12), 0 3px 10px rgba(0,0,0,0.25)",
};

const saveBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 18px", borderRadius: 10,
  border: "1px solid rgba(100,180,100,0.4)",
  background: "linear-gradient(180deg, #2d5a2d, #4a9a4a)",
  color: "#e8f5e8", fontSize: 14, fontWeight: 800, cursor: "pointer",
};

const cancelBtnStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 18px", borderRadius: 10,
  border: "1px solid rgba(180,60,60,0.4)",
  background: "rgba(70,15,15,0.6)",
  color: "#ffaaaa", fontSize: 14, fontWeight: 800, cursor: "pointer",
};

const heroCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(74,48,16,0.9) 0%, rgba(50,30,6,0.95) 100%)",
  border: "1px solid rgba(200,134,63,0.3)",
  borderRadius: 20,
  padding: "28px 28px",
  display: "flex",
  alignItems: "center",
  gap: 24,
  marginBottom: 16,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,220,140,0.06)",
};

const sectionCardStyle: React.CSSProperties = {
  background: "rgba(44,30,12,0.6)",
  border: "1px solid rgba(200,134,63,0.18)",
  borderRadius: 16,
  padding: "18px 20px",
  marginBottom: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 5,
  background: "rgba(200,134,63,0.18)",
  border: "1px solid rgba(200,134,63,0.3)",
  color: "#f2d98a",
  borderRadius: 8, padding: "3px 10px",
  fontSize: 13, fontWeight: 700,
};
