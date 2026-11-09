export const FEEDBACK_EMAIL = "ch0556731857@gmail.com";

// FormSubmit מעביר את הטופס כמייל לכתובת שלמעלה, בלי צורך בשרת.
// בפעם הראשונה תגיע למייל בקשת אישור (Activate) — יש ללחוץ עליה פעם אחת.
const ENDPOINT = `https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`;

export type FeedbackType = "bug" | "improvement" | "other";

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  bug: "דיווח על תקלה",
  improvement: "בקשה לשיפור",
  other: "אחר",
};

export interface FeedbackPayload {
  type: FeedbackType;
  title: string;
  description: string;
  page?: string;
  reporterName?: string;
  reporterEmail?: string;
}

export async function sendFeedback(payload: FeedbackPayload): Promise<void> {
  const typeLabel = FEEDBACK_TYPE_LABELS[payload.type];
  const body = {
    _subject: `[מערכת תלמידים] ${typeLabel}: ${payload.title}`,
    _template: "table",
    _captcha: "false",
    ...(payload.reporterEmail ? { _replyto: payload.reporterEmail } : {}),
    "סוג פנייה": typeLabel,
    "כותרת": payload.title,
    "תיאור": payload.description,
    "עמוד": payload.page || "—",
    "שם המדווח": payload.reporterName || "—",
    "מייל המדווח": payload.reporterEmail || "—",
    "דפדפן": navigator.userAgent,
    "תאריך": new Date().toLocaleString("he-IL"),
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("לא ניתן היה להתחבר לשירות השליחה. בדקו את החיבור לאינטרנט.");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok || (data && (data.success === false || data.success === "false"))) {
    throw new Error("השליחה נכשלה. נסו שוב או שלחו מייל ישירות.");
  }
}

export function buildMailtoLink(payload: FeedbackPayload): string {
  const subject = `[מערכת תלמידים] ${FEEDBACK_TYPE_LABELS[payload.type]}: ${payload.title}`;
  const text = `${payload.description}\n\nעמוד: ${payload.page || "—"}\nשם: ${payload.reporterName || "—"}`;
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
}
