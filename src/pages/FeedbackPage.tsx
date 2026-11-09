import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bug, Lightbulb, MessageSquare, Send, CheckCircle2, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getMyProfile } from "../api/tuitionApi";
import {
  sendFeedback,
  buildMailtoLink,
  FEEDBACK_EMAIL,
  type FeedbackType,
  type FeedbackPayload,
} from "../api/feedbackApi";
import "./FeedbackPage.css";

const TYPES: { value: FeedbackType; label: string; hint: string; icon: typeof Bug }[] = [
  { value: "bug", label: "דיווח על תקלה", hint: "משהו לא עובד כמו שצריך", icon: Bug },
  { value: "improvement", label: "בקשה לשיפור", hint: "רעיון או תוספת שתעזור לעבודה", icon: Lightbulb },
  { value: "other", label: "אחר", hint: "כל הערה או שאלה אחרת", icon: MessageSquare },
];

const PAGE_NAMES: Record<string, string> = {
  "/": "בית",
  "/search": "חיפוש",
  "/database": "מסד נתונים",
  "/edit": "עריכה",
  "/alumni": "בוגרים",
  "/payments": "תשלומים",
  "/ai": "עוזר AI",
};

function describePage(path: string): string {
  if (!path) return "";
  if (PAGE_NAMES[path]) return `${PAGE_NAMES[path]} (${path})`;
  if (path.startsWith("/student/") && path.endsWith("/tuition")) return `שכר לימוד (${path})`;
  if (path.startsWith("/student/")) return `כרטיס תלמיד (${path})`;
  if (path.startsWith("/alumni/")) return `כרטיס בוגר (${path})`;
  return path;
}

export default function FeedbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const fromPage = (location.state as { from?: string } | null)?.from ?? "";

  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [page, setPage] = useState(describePage(fromPage));
  const [name, setName] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getMyProfile().then((p) => { if (p) setName((n) => n || p.displayName || ""); }).catch(() => {});
  }, []);

  const payload: FeedbackPayload = {
    type,
    title: title.trim(),
    description: description.trim(),
    page: page.trim(),
    reporterName: name.trim(),
    reporterEmail: user?.email ?? undefined,
  };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!payload.title || !payload.description) {
      setError("יש למלא כותרת ותיאור.");
      return;
    }
    setError("");
    setSending(true);
    try {
      await sendFeedback(payload);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "השליחה נכשלה.");
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setTitle("");
    setDescription("");
    setType("bug");
    setSent(false);
  }

  if (sent) {
    return (
      <div className="feedback-page">
        <div className="feedback-card feedback-success">
          <CheckCircle2 size={56} />
          <h2>תודה! הפנייה נשלחה</h2>
          <p>הפנייה התקבלה ותטופל בהקדם.</p>
          <div className="feedback-success-actions">
            <button className="feedback-btn" onClick={resetForm}>שליחת פנייה נוספת</button>
            <button className="feedback-btn secondary" onClick={() => navigate(fromPage || "/")}>חזרה</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-page">
      <div className="feedback-card">
        <header className="feedback-header">
          <h1>דיווח על תקלה / בקשה לשיפור</h1>
          <p>נתקלתם בבעיה? יש לכם רעיון שיקל על העבודה? כתבו כאן והפנייה תישלח ישירות למפתח המערכת.</p>
        </header>

        <form onSubmit={handleSubmit} className="feedback-form">
          <div className="feedback-types" role="radiogroup" aria-label="סוג פנייה">
            {TYPES.map(({ value, label, hint, icon: Icon }) => (
              <button
                type="button"
                key={value}
                role="radio"
                aria-checked={type === value}
                className={`feedback-type${type === value ? " selected" : ""}`}
                onClick={() => setType(value)}
              >
                <Icon size={22} />
                <span className="feedback-type-label">{label}</span>
                <span className="feedback-type-hint">{hint}</span>
              </button>
            ))}
          </div>

          <label className="feedback-field">
            <span>כותרת *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder={type === "bug" ? "לדוגמה: כפתור השמירה בעריכה לא מגיב" : "תיאור קצר של הבקשה"}
              required
            />
          </label>

          <label className="feedback-field">
            <span>תיאור מפורט *</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={7}
              maxLength={5000}
              placeholder={
                type === "bug"
                  ? "מה עשיתם? מה ציפיתם שיקרה? מה קרה בפועל? אם הופיעה הודעת שגיאה — העתיקו אותה לכאן."
                  : "תארו מה הייתם רוצים שיתווסף או ישתנה, ולמה זה יעזור."
              }
              required
            />
          </label>

          <div className="feedback-row">
            <label className="feedback-field">
              <span>באיזה עמוד?</span>
              <input value={page} onChange={(e) => setPage(e.target.value)} placeholder="לדוגמה: תשלומים" />
            </label>
            <label className="feedback-field">
              <span>שם המדווח</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם" />
            </label>
          </div>

          {error && (
            <div className="feedback-error" role="alert">
              {error}{" "}
              {payload.title && payload.description && (
                <a href={buildMailtoLink(payload)}>שליחה דרך תוכנת המייל</a>
              )}
            </div>
          )}

          <button type="submit" className="feedback-btn feedback-submit" disabled={sending}>
            <Send size={18} />
            {sending ? "שולח..." : "שליחת הפנייה"}
          </button>

          <p className="feedback-alt">
            <Mail size={14} /> אפשר גם לכתוב ישירות ל־<a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>
          </p>
        </form>
      </div>
    </div>
  );
}
