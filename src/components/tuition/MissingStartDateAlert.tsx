import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useStudents } from '../../context/StudentsContext';
import { useAuth } from '../../context/AuthContext';
import StartDatePolicy from './StartDatePolicy';

const SEEN_KEY = 'missingStartDateAlertSeen:';

function wasShown(userId: string): boolean {
  try { return sessionStorage.getItem(SEEN_KEY + userId) === '1'; } catch { return false; }
}
function markShown(userId: string) {
  try { sessionStorage.setItem(SEEN_KEY + userId, '1'); } catch { /* storage unavailable — fine */ }
}

/**
 * Students without a billing start date are silently skipped by the monthly charge.
 * Shows a navbar badge while any exist, and pops a dialog once per login session.
 *
 * Deliberately NO bulk "set a date for everyone" action: a start date must reflect the
 * student's real start of charging, so each student is reviewed individually (card →
 * edit → consequences dialog).
 */
export default function MissingStartDateAlert() {
  const { students, loading } = useStudents();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const missing = useMemo(() => students.filter((s) => !s.tuitionStartDate), [students]);

  // Per-user session decision. Re-evaluated whenever the logged-in user changes, so it
  // also works when this component mounted before login (or after switching account).
  // Uses the "adjust state when an input changes" render pattern — no effect setState.
  const [decision, setDecision] = useState<{ uid: string | null; auto: boolean }>({ uid: null, auto: false });
  if (decision.uid !== userId) {
    setDecision({ uid: userId, auto: userId ? !wasShown(userId) : false });
  }
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  const autoOpen =
    !!userId && decision.uid === userId && decision.auto && dismissedFor !== userId &&
    !loading && missing.length > 0;
  const open = !!userId && (manualOpen || autoOpen);

  useEffect(() => {
    if (autoOpen && userId) markShown(userId);
  }, [autoOpen, userId]);

  if (!userId || (missing.length === 0 && !open)) return null;

  function close() {
    setManualOpen(false);
    setDismissedFor(userId);
  }

  return (
    <>
      {missing.length > 0 && (
        <button type="button" data-testid="missing-start-date-badge" onClick={() => setManualOpen(true)}
          title="תלמידים ללא תאריך תחילת גבייה לא יחויבו"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffebee', color: '#b71c1c', border: '1px solid #ef9a9a', borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          <AlertTriangle size={14} /> {missing.length} ללא תאריך גבייה
        </button>
      )}

      {open && (
        <div role="dialog" aria-modal="true" aria-label="תלמידים ללא תאריך תחילת גבייה" onClick={close}
          style={{ position: 'fixed', inset: 0, background: 'rgba(40,20,5,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1900, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fffdf8', borderRadius: 18, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '22px 24px', direction: 'rtl', textAlign: 'right' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 900, color: '#b71c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} /> {missing.length} תלמידים ללא תאריך תחילת גבייה
            </h3>
            <p style={{ margin: '0 0 10px', color: '#3a1e08', fontSize: 14, lineHeight: 1.6 }}>
              תלמיד בלי תאריך תחילת גבייה <b>לא מחויב בחיוב החודשי</b> — בלי שום התראה.
              יש לבדוק כל תלמיד בנפרד: האם הוא זכאי לחיוב, וממתי התחיל החיוב שלו בפועל,
              ולקבוע את התאריך בכרטיס התלמיד. לפני השמירה יוצגו ההשלכות.
            </p>
            <ul data-testid="missing-list" style={{ margin: '0 0 12px', paddingInlineStart: 20, maxHeight: 240, overflowY: 'auto', fontSize: 14, lineHeight: 1.8 }}>
              {missing.map((s) => (
                <li key={s.id}>
                  <Link to={`/student/${s.passportOrId || s.id}`} onClick={close} style={{ color: '#8b4f1f', fontWeight: 700 }}>
                    {s.lastName} {s.firstName}
                  </Link>
                  {s.className ? ` — ${s.className}` : ''}
                  {s.tuition ? ` · שכ"ל ${s.tuition}${s.tuitionCurrency ? ' ' + s.tuitionCurrency : ''}` : ' · ללא שכ"ל'}
                </li>
              ))}
            </ul>
            <StartDatePolicy compact />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={close}
                style={{ background: '#f5efe4', color: '#5b331a', border: '1px solid #e2cfa9', borderRadius: 12, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
