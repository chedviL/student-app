import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { Pencil, X, Check, Loader2, ChevronLeft } from "lucide-react";
import { useAlumni } from "../context/AlumniContext";
import { updateAlumnus } from "../api/alumniApi";
import type { Alumni } from "../types/student";
import { useStudentTuition } from "../hooks/useStudentTuition";
import { TuitionModal } from "../components/tuition/TuitionModal";
import { formatDate } from "../utils/dateHelpers";
import "./AlumniPage.css";

function fmtDate(val: string | undefined): string {
  if (!val) return "";
  if (val.includes(".")) return val;
  const m = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return val;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delayChildren: 0.15, staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.35 } },
};

type FieldDef = { key: keyof Alumni; label: string; type?: "text" | "email" | "tel" };

const DISPLAY_FIELDS: FieldDef[] = [
  { key: "alumniPhone",        label: "טלפון אישי",  type: "tel" },
  { key: "fatherName",         label: "שם האב" },
  { key: "fatherPhone",        label: "טלפון אב",    type: "tel" },
  { key: "homePhone",          label: "טלפון בית",   type: "tel" },
  { key: "city",               label: "עיר" },
  { key: "street",             label: "רחוב" },
  { key: "email",              label: "מייל",        type: "email" },
  { key: "community",          label: "קהילה" },
  { key: "paymentStatusNotes", label: "הערה" },
  { key: "tuitionStartDate",   label: "תחילת גבייה" },
];

/* ─── inline style helpers ─────────────────────────────────── */
const card: React.CSSProperties = {
  background: "rgba(22,28,38,0.98)",
  border: "1px solid rgba(148,163,184,0.18)",
  borderRadius: 22,
  padding: "24px 20px 20px",
  boxShadow: "0 12px 36px rgba(0,0,0,0.35)",
  direction: "rtl",
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "#64748b",
  marginBottom: 4,
  display: "block",
  letterSpacing: "0.03em",
};

const valueStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#e2e8f0",
};

const emptyStyle: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(148,163,184,0.35)",
};

const cellStyle: React.CSSProperties = {
  background: "rgba(15,20,30,0.5)",
  border: "1px solid rgba(148,163,184,0.12)",
  borderRadius: 12,
  padding: "10px 12px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid rgba(148,163,184,0.3)",
  background: "rgba(10,14,22,0.8)",
  color: "#e2e8f0",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

/* ─── main component ────────────────────────────────────────── */
export default function AlumniCardPage() {
  const { alumniId } = useParams();
  const navigate     = useNavigate();
  const { alumni, loading, error, updateLocal } = useAlumni();

  const [copied, setCopied]           = useState<string | null>(null);
  const [editMode, setEditMode]       = useState(false);
  const [draft, setDraft]             = useState<Partial<Alumni>>({});
  const [saving, setSaving]           = useState(false);
  const [saveError, setSaveError]     = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showTuition, setShowTuition] = useState(false);

  const alumnus = useMemo(
    () => alumni.find((a) => String(a.passportOrId || a.id || "") === String(alumniId || "")) ?? null,
    [alumni, alumniId]
  );

  const { balance, loading: balLoading, refresh: refreshBalance } = useStudentTuition(alumnus?.id ?? "");
  const tuitionCurrency = balance?.currency ?? null;
  const tuitionBal      = balance?.currentBalance ?? 0;
  const tuitionSym      = tuitionCurrency === "USD" ? "$" : "₪";
  const tuitionLabel =
    balLoading
      ? "..."
      : !tuitionCurrency || balance?.status === "no_currency"
      ? "לא הוגדר"
      : tuitionBal === 0
      ? `0 ${tuitionSym}`
      : `${tuitionBal > 0 ? "+" : ""}${tuitionBal.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${tuitionSym}`;

  const tuitionBtnColors =
    balLoading || !tuitionCurrency || balance?.status === "no_currency"
      ? { bg: "linear-gradient(180deg,rgba(45,55,72,0.9),rgba(30,37,48,0.95))", color: "#94a3b8", border: "1px solid rgba(148,163,184,0.2)" }
      : tuitionBal < 0
      ? { bg: "linear-gradient(180deg,rgba(80,15,15,0.85),rgba(50,10,10,0.95))", color: "#fca5a5", border: "1px solid rgba(180,50,50,0.4)" }
      : { bg: "linear-gradient(180deg,rgba(15,50,30,0.9),rgba(10,38,22,0.95))",  color: "#6ee7b7", border: "1px solid rgba(50,150,90,0.4)" };

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

  /* ── states ── */
  if (loading) return (
    <div className="al-page with-navbar" style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
      <Loader2 size={32} style={{ color: "#64748b", animation: "spin 1s linear infinite" }} />
    </div>
  );

  if (error) return (
    <div className="al-page with-navbar" style={{ display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <p style={{ color: "#fca5a5" }}>{error}</p>
      <button onClick={() => navigate(-1)} style={{ ...inputStyle, width:"auto", cursor:"pointer" }}>חזרה</button>
    </div>
  );

  if (!alumnus) return (
    <div className="al-page with-navbar" style={{ display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:16 }}>
      <p style={{ color: "#cbd5e1" }}>הבוגר לא נמצא</p>
      <button onClick={() => navigate(-1)} style={{ ...inputStyle, width:"auto", cursor:"pointer" }}>חזרה</button>
    </div>
  );

  /* ── main render ── */
  return (
    <motion.div
      className="al-page with-navbar"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
      style={{ direction: "rtl" }}
    >
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 4px" }}>
        <motion.div style={card} variants={containerVariants} initial="hidden" animate="visible">

          {/* ── Top bar ── */}
          <motion.div variants={itemVariants}
            style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20 }}>
            <button
              onClick={() => navigate(-1)}
              style={{ display:"flex", alignItems:"center", gap:6, background:"transparent",
                border:"1px solid rgba(148,163,184,0.25)", borderRadius:10, padding:"7px 14px",
                color:"#94a3b8", fontSize:14, fontWeight:700, cursor:"pointer" }}>
              חזרה
            </button>

            <div style={{ display:"flex", gap:8 }}>
              {!editMode ? (
                <button onClick={enterEdit}
                  style={{ display:"flex", alignItems:"center", gap:6, background:"linear-gradient(180deg,#334155,#1e293b)",
                    border:"1px solid rgba(148,163,184,0.25)", borderRadius:10, padding:"7px 16px",
                    color:"#cbd5e1", fontSize:14, fontWeight:800, cursor:"pointer" }}>
                  <Pencil size={15} /> ערוך
                </button>
              ) : (
                <>
                  <button onClick={saveEdit} disabled={saving}
                    style={{ display:"flex", alignItems:"center", gap:6, background:"linear-gradient(180deg,#1e3a2d,#2d6a4a)",
                      border:"1px solid rgba(50,150,90,0.4)", borderRadius:10, padding:"7px 16px",
                      color:"#d1fae5", fontSize:14, fontWeight:800, cursor:"pointer" }}>
                    {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                    {saving ? "שומר..." : "שמור"}
                  </button>
                  <button onClick={cancelEdit}
                    style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(50,15,15,0.7)",
                      border:"1px solid rgba(180,50,50,0.35)", borderRadius:10, padding:"7px 16px",
                      color:"#fca5a5", fontSize:14, fontWeight:800, cursor:"pointer" }}>
                    <X size={15} /> בטל
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* ── Hero ── */}
          <motion.div variants={itemVariants}
            style={{ display:"flex", alignItems:"center", gap:16, marginBottom:16,
              padding:"16px 18px", background:"rgba(15,20,30,0.6)",
              border:"1px solid rgba(148,163,184,0.14)", borderRadius:16 }}>
            <div style={{ width:56, height:56, borderRadius:"50%", flexShrink:0,
              background:"rgba(148,163,184,0.08)", border:"2px solid rgba(148,163,184,0.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:"rgba(148,163,184,0.5)", fontWeight:900 }}>
              {(alumnus.lastName?.[0] ?? "?")}
            </div>
            <div style={{ flex:1 }}>
              {editMode ? (
                <div style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <input style={{ ...inputStyle, fontSize:17, fontWeight:700 }}
                    value={draft.lastName ?? ""} placeholder="שם משפחה"
                    onChange={(e) => setDraft((d) => ({ ...d, lastName: e.target.value }))} />
                  <input style={{ ...inputStyle, fontSize:17, fontWeight:700 }}
                    value={draft.firstName ?? ""} placeholder="שם פרטי"
                    onChange={(e) => setDraft((d) => ({ ...d, firstName: e.target.value }))} />
                </div>
              ) : (
                <h2 style={{ margin:"0 0 6px", fontSize:24, fontWeight:900, color:"#f1f5f9" }}>
                  {alumnus.lastName} {alumnus.firstName}
                </h2>
              )}
              <div style={{ display:"flex", flexWrap:"wrap", gap:10, fontSize:13, color:"#64748b", fontWeight:600 }}>
                {alumnus.passportOrId && <span>ת"ז: {alumnus.passportOrId}</span>}
                {editMode ? (
                  <input style={{ ...inputStyle, width:110 }}
                    value={draft.className ?? ""} placeholder="שיעור"
                    onChange={(e) => setDraft((d) => ({ ...d, className: e.target.value }))} />
                ) : alumnus.className && (
                  <span>שיעור: {alumnus.className}</span>
                )}
                {alumnus.graduatedAt && <span>עזב: {formatDate(alumnus.graduatedAt)}</span>}
              </div>
            </div>
          </motion.div>

          {/* ── Feedback ── */}
          <AnimatePresence>
            {(saveSuccess || saveError) && (
              <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ marginBottom:14, padding:"10px 14px", borderRadius:10, fontWeight:700, fontSize:14,
                  background: saveSuccess ? "rgba(15,50,30,0.7)" : "rgba(60,15,15,0.7)",
                  border: saveSuccess ? "1px solid rgba(50,150,90,0.35)" : "1px solid rgba(180,50,50,0.35)",
                  color: saveSuccess ? "#6ee7b7" : "#fca5a5" }}>
                {saveSuccess ? "✔ הנתונים נשמרו בהצלחה" : `✖ ${saveError}`}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Grid ── */}
          <motion.div variants={containerVariants}
            style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(175px,1fr))", gap:10 }}>

            {DISPLAY_FIELDS.map((field) => {
              const val = alumnus[field.key] as string | undefined;
              const displayVal = field.key === "tuitionStartDate" ? (formatDate(val ?? null) ?? "") : (val ?? "");
              return (
                <motion.div key={field.key} variants={itemVariants} style={cellStyle}>
                  <span style={labelStyle}>{field.label}</span>
                  {editMode ? (
                    <input style={inputStyle}
                      type={field.type ?? "text"}
                      value={(draft[field.key] as string) ?? ""}
                      placeholder={field.label}
                      dir={field.type === "tel" || field.type === "email" ? "ltr" : undefined}
                      onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))} />
                  ) : field.type === "email" && displayVal ? (
                    <a href={`https://mail.google.com/mail/?view=cm&to=${displayVal}`}
                      target="_blank" rel="noreferrer"
                      style={{ ...valueStyle, direction:"ltr", unicodeBidi:"isolate", textDecoration:"none" }}>
                      {displayVal}
                    </a>
                  ) : field.type === "tel" && displayVal ? (
                    <span style={{ ...valueStyle, cursor:"pointer", direction:"ltr", unicodeBidi:"isolate" }}
                      onClick={() => copyPhone(displayVal, field.key)} title="לחץ להעתקה">
                      {copied === field.key ? "✔ הועתק!" : displayVal}
                    </span>
                  ) : (
                    <span style={displayVal ? valueStyle : emptyStyle}>{displayVal || "—"}</span>
                  )}
                </motion.div>
              );
            })}

            {/* תאריך לידה */}
            <motion.div variants={itemVariants} style={cellStyle}>
              <span style={labelStyle}>תאריך לידה</span>
              {editMode ? (
                <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                  <input style={inputStyle} value={draft.hebrewDate ?? ""} placeholder="עברי"
                    onChange={(e) => setDraft((d) => ({ ...d, hebrewDate: e.target.value }))} />
                  <input style={inputStyle} value={draft.gregorianDate ?? ""} placeholder="לועזי"
                    onChange={(e) => setDraft((d) => ({ ...d, gregorianDate: e.target.value }))} />
                </div>
              ) : (
                <span style={{ display:"flex", flexDirection:"column", gap:2 }}>
                  {alumnus.hebrewDate && <span style={valueStyle}>{alumnus.hebrewDate}</span>}
                  {alumnus.gregorianDate && <span style={{ ...valueStyle, direction:"ltr", unicodeBidi:"isolate", fontSize:13 }}>{fmtDate(alumnus.gregorianDate)}</span>}
                  {!alumnus.hebrewDate && !alumnus.gregorianDate && <span style={emptyStyle}>—</span>}
                </span>
              )}
            </motion.div>

            {/* כפתור חזרה */}
            <motion.div variants={itemVariants}
              style={{ ...cellStyle, padding:0, overflow:"hidden", minHeight:72 }}>
              <button onClick={() => navigate(-1)}
                style={{ width:"100%", height:"100%", minHeight:72, background:"linear-gradient(180deg,#334155,#1e293b)",
                  border:"none", borderRadius:12, color:"#94a3b8", fontSize:16, fontWeight:800,
                  cursor:"pointer", transition:"transform 0.15s" }}>
                חזרה
              </button>
            </motion.div>

            {/* כפתור מצב שכ"ל */}
            <motion.div variants={itemVariants}
              style={{ ...cellStyle, padding:0, overflow:"hidden", minHeight:72 }}>
              <button onClick={() => setShowTuition(true)}
                style={{ width:"100%", height:"100%", minHeight:72, display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center", gap:4,
                  background: tuitionBtnColors.bg, border: tuitionBtnColors.border,
                  borderRadius:12, color: tuitionBtnColors.color,
                  fontSize:15, fontWeight:800, cursor:"pointer", padding:"12px 16px" }}>
                <span style={{ display:"flex", alignItems:"center", gap:4, fontSize:10, fontWeight:700, opacity:0.7, letterSpacing:"0.03em" }}>
                  מצב שכ"ל <ChevronLeft size={13} />
                </span>
                <span style={{ fontSize:15, fontWeight:900, direction:"ltr", unicodeBidi:"isolate" }}>
                  {tuitionLabel}
                </span>
              </button>
            </motion.div>

          </motion.div>
        </motion.div>
      </div>

      {showTuition && (
        <TuitionModal student={alumnus} onClose={() => setShowTuition(false)} onTransactionAdded={refreshBalance} />
      )}
    </motion.div>
  );
}
