import { useState } from 'react';
import type { StartDateChangeExplanation, StartDateChangeGroup } from '../../constants/tuitionPolicy';
import { formatHe } from '../../constants/tuitionPolicy';
import StartDatePolicy from './StartDatePolicy';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(40,20,5,0.45)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16,
};
const box: React.CSSProperties = {
  background: '#fffdf8', borderRadius: 18, maxWidth: 600, width: '100%', maxHeight: '90vh',
  overflowY: 'auto', padding: '22px 24px', direction: 'rtl', boxShadow: '0 12px 40px rgba(60,30,10,0.3)',
};
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#8b6544', margin: '10px 0 4px' };
const list: React.CSSProperties = { margin: 0, paddingInlineStart: 20, color: '#3a1e08', fontSize: 14, lineHeight: 1.6 };

function Explanation({ e }: { e: StartDateChangeExplanation }) {
  return (
    <>
      <div style={sectionTitle}>מה יקרה</div>
      <ul data-testid="consequences" style={list}>{e.consequences.map((c) => <li key={c}>{c}</li>)}</ul>
      {e.whatToDo.length > 0 && (
        <>
          <div style={sectionTitle}>מה לעשות</div>
          <ul data-testid="what-to-do" style={list}>{e.whatToDo.map((c) => <li key={c}>{c}</li>)}</ul>
        </>
      )}
    </>
  );
}

/**
 * Shown before saving any change to tuition_start_date. Takes one group per distinct
 * current date, so a bulk change explains the consequences for EVERY group of students.
 * If any group is "blocked"/"invalid" the change cannot be confirmed.
 */
export default function StartDateChangeDialog({
  groups, busy = false, onConfirm, onCancel,
}: {
  groups: StartDateChangeGroup[];
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [showPolicy, setShowPolicy] = useState(false);
  const total = groups.reduce((n, g) => n + g.count, 0);
  const blocked = groups.some((g) => g.explanation.kind === 'blocked' || g.explanation.kind === 'invalid');
  const single = groups.length === 1;
  const title = single ? groups[0].explanation.title : `שינוי תאריך תחילת גבייה — ${groups.length} קבוצות תלמידים`;

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="השלכות שינוי תאריך תחילת גבייה" onClick={onCancel}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 900, color: blocked ? '#b71c1c' : '#5b331a' }}>{title}</h3>
        {total > 1 && (
          <div data-testid="affected-total" style={{ fontSize: 13.5, fontWeight: 800, color: '#e65100', marginBottom: 6 }}>
            השינוי יחול על {total} תלמידים.
          </div>
        )}
        {single ? (
          <Explanation e={groups[0].explanation} />
        ) : (
          groups.map((g) => (
            <div key={g.oldDate ?? 'none'} data-testid="change-group"
              style={{ border: '1px solid #ecd9b4', borderRadius: 12, padding: '8px 14px', marginTop: 10, background: '#fffaf0' }}>
              <div style={{ fontWeight: 900, color: '#5a3420', fontSize: 14 }}>
                {g.count} תלמידים {g.oldDate ? `שהתאריך הנוכחי שלהם ${formatHe(g.oldDate)}` : 'ללא תאריך כיום'} — {g.explanation.title}
              </div>
              <Explanation e={g.explanation} />
            </div>
          ))
        )}
        <button type="button" onClick={() => setShowPolicy((v) => !v)}
          style={{ marginTop: 12, background: 'none', border: 'none', color: '#8b4f1f', fontWeight: 800, cursor: 'pointer', padding: 0, fontSize: 13 }}>
          {showPolicy ? 'הסתר מדיניות' : 'הצג מדיניות'}
        </button>
        {showPolicy && <div style={{ marginTop: 8 }}><StartDatePolicy compact /></div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start', marginTop: 18 }}>
          {!blocked && (
            <button type="button" onClick={onConfirm} disabled={busy}
              style={{ background: 'linear-gradient(180deg,#c8863f,#a5662a)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'שומר...' : 'הבנתי — שמור'}
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ background: '#f5efe4', color: '#5b331a', border: '1px solid #e2cfa9', borderRadius: 12, padding: '10px 20px', fontWeight: 800, cursor: 'pointer' }}>
            {blocked ? 'חזרה' : 'ביטול'}
          </button>
        </div>
      </div>
    </div>
  );
}
