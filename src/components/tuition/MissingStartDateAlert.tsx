import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useStudents } from '../../context/StudentsContext';
import { useAuth } from '../../context/AuthContext';
import { updateStudent } from '../../api/studentsApi';
import { DEFAULT_TUITION_START_DATE, describeStartDateChange, formatHe } from '../../constants/tuitionPolicy';
import StartDateChangeDialog from './StartDateChangeDialog';
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
 */
export default function MissingStartDateAlert() {
  const { students, loading, updateLocal } = useStudents();
  const { user } = useAuth();
  const missing = useMemo(() => students.filter((s) => !s.tuitionStartDate), [students]);
  // Auto-open is decided once per mount (per login session via sessionStorage),
  // and derived during render — no setState inside an effect.
  const [autoEligible] = useState(() => (user ? !wasShown(user.id) : false));
  const [dismissed, setDismissed] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const autoOpen = autoEligible && !dismissed && !loading && missing.length > 0;
  const open = manualOpen || autoOpen;
  const setOpen = (v: boolean) => { setManualOpen(v); if (!v) setDismissed(true); };
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; failed: string[] } | null>(null);

  useEffect(() => {
    if (autoOpen && user) markShown(user.id);
  }, [autoOpen, user]);

  if (missing.length === 0 && !open) return null;

  async function applyDefault() {
    setBusy(true);
    let ok = 0;
    const failed: string[] = [];
    for (const s of missing) {
      try {
        const saved = await updateStudent(s.id, { tuitionStartDate: DEFAULT_TUITION_START_DATE });
        updateLocal(saved);
        ok++;
      } catch (e) {
        failed.push(`${s.lastName} ${s.firstName}: ${e instanceof Error ? e.message : 'שגיאה'}`);
      }
    }
    setBusy(false);
    setConfirming(false);
    setResult({ ok, failed });
  }

  return (
    <>
      {missing.length > 0 && (
        <button type="button" data-testid="missing-start-date-badge" onClick={() => { setResult(null); setOpen(true); }}
          title="תלמידים ללא תאריך תחילת גבייה לא יחויבו"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ffebee', color: '#b71c1c', border: '1px solid #ef9a9a', borderRadius: 999, padding: '4px 12px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          <AlertTriangle size={14} /> {missing.length} ללא תאריך גבייה
        </button>
      )}

      {open && !confirming && (
        <div role="dialog" aria-modal="true" aria-label="תלמידים ללא תאריך תחילת גבייה" onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(40,20,5,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1900, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: '#fffdf8', borderRadius: 18, maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '22px 24px', direction: 'rtl', textAlign: 'right' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 900, color: '#b71c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={20} /> {missing.length > 0 ? `${missing.length} תלמידים ללא תאריך תחילת גבייה` : 'כל התלמידים עם תאריך תחילת גבייה'}
            </h3>
            {result && (
              <div data-testid="apply-result" style={{ background: result.failed.length ? '#fff3e0' : '#e8f5e9', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 13.5 }}>
                עודכנו {result.ok} תלמידים.{result.failed.length > 0 && <> נכשלו {result.failed.length}: {result.failed.join(' · ')}</>}
              </div>
            )}
            {missing.length > 0 && (
              <>
                <p style={{ margin: '0 0 10px', color: '#3a1e08', fontSize: 14, lineHeight: 1.6 }}>
                  תלמיד בלי תאריך תחילת גבייה <b>לא מחויב בחיוב החודשי</b> — בלי שום התראה.
                  לפי המדיניות, לכל התלמידים התאריך הוא {formatHe(DEFAULT_TUITION_START_DATE)}.
                </p>
                <ul data-testid="missing-list" style={{ margin: '0 0 12px', paddingInlineStart: 20, maxHeight: 220, overflowY: 'auto', fontSize: 14 }}>
                  {missing.map((s) => (
                    <li key={s.id}>
                      <Link to={`/student/${s.passportOrId || s.id}`} onClick={() => setOpen(false)} style={{ color: '#8b4f1f', fontWeight: 700 }}>
                        {s.lastName} {s.firstName}
                      </Link>
                      {s.className ? ` — ${s.className}` : ''}{s.tuition ? ` · שכ"ל ${s.tuition}` : ' · ללא שכ"ל'}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <StartDatePolicy compact />
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              {missing.length > 0 && (
                <button type="button" onClick={() => setConfirming(true)}
                  style={{ background: 'linear-gradient(180deg,#c8863f,#a5662a)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>
                  קבע {formatHe(DEFAULT_TUITION_START_DATE)} ל-{missing.length} התלמידים
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)}
                style={{ background: '#f5efe4', color: '#5b331a', border: '1px solid #e2cfa9', borderRadius: 12, padding: '10px 18px', fontWeight: 800, cursor: 'pointer' }}>
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {confirming && (
        <StartDateChangeDialog
          explanation={describeStartDateChange(null, DEFAULT_TUITION_START_DATE)}
          affectedCount={missing.length}
          busy={busy}
          onConfirm={applyDefault}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
