import { Link, useLocation } from "react-router-dom";
import { MessageSquareWarning } from "lucide-react";
import "../../pages/FeedbackPage.css";

/** כפתור צף בכל עמוד — מוביל לעמוד דיווח תקלות ובקשות שיפור */
export default function FeedbackButton() {
  const { pathname } = useLocation();
  if (pathname === "/feedback" || pathname === "/ai") return null;

  return (
    <Link
      to="/feedback"
      state={{ from: pathname }}
      className="feedback-fab"
      title="דיווח על תקלה / בקשה לשיפור"
      aria-label="דיווח על תקלה / בקשה לשיפור"
    >
      <MessageSquareWarning size={20} />
      <span className="feedback-fab-label">דיווח תקלה / הצעה</span>
    </Link>
  );
}
