import { useState } from 'react';
import type { StartDateChangeExplanation } from '../../constants/tuitionPolicy';
import StartDatePolicy from './StartDatePolicy';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(40,20,5,0.45)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16,
};
const box: React.CSSProperties = {
  background: '#fffdf8', borderRadius: 18, maxWidth: 560, width: '100%', maxHeight: '90vh',
  overflowY: 'auto', padding: '22px 24px', direction: 'rtl', boxShadow: '0 12px 40px rgba(60,30,10,0.3)',
};

/**
 * Shown before saving a change to tuition_start_date: explains what will happen to
 * charges, what to do next, and the written policy. "blocked"/"invalid" cannot be confirmed.
 */
export default function StartDateChangeDialog({
  explanation, affectedCount = 1, busy = false, onConfirm, onCancel,
}: {
  explanation: StartDateChangeExplanation;
  affectedCount?: number;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [showPolicy, setShowPolicy] = useState(false);
  const canConfirm = explanation.kind !== 'blocked' && explanation.kind !== 'invalid';
  const danger = explanation.kind === 'blocked' || explanation.kind === 'invalid';
  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="השלכות שינוי תאריך תחילת גבייה" onClick={onCancel}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 6px', fontSize: 19, fontWeight: 900, color: danger ? '#b71c1c' : '#5b331a' }}>{explanation.title}</h3>
        {affectedCount > 1 && (
          <div style={{ fontSize: 13.5, fontWeight: 800, color: '#e65100', marginBottom: 8 }}>השינוי יחול על {affectedCount} תלמידים.</div>
        )}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#8b6544', margin: '10px 0 4px' }}>מה יקרה</div>
        <ul data-testid="consequences" style={{ margin: 0, paddingInlineStart: 20, color: '#3a1e08', fontSize: 14, lineHeight: 1.6 }}>
          {explanation.consequences.map((c) => <li key={c}>{c}</li>)}
        </ul>
        {explanation.whatToDo.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#8b6544', margin: '12px 0 4px' }}>מה לעשות</div>
            <ul data-testid="what-to-do" style={{ margin: 0, paddingInlineStart: 20, color: '#3a1e08', fontSize: 14, lineHeight: 1.6 }}>
              {explanation.whatToDo.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </>
        )}
        <button type="button" onClick={() => setShowPolicy((v) => !v)}
          style={{ marginTop: 12, background: 'none', border: 'none', color: '#8b4f1f', fontWeight: 800, cursor: 'pointer', padding: 0, fontSize: 13 }}>
          {showPolicy ? 'הסתר מדיניות' : 'הצג מדיניות'}
        </button>
        {showPolicy && <div style={{ marginTop: 8 }}><StartDatePolicy compact /></div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-start', marginTop: 18 }}>
          {canConfirm && (
            <button type="button" onClick={onConfirm} disabled={busy}
              style={{ background: 'linear-gradient(180deg,#c8863f,#a5662a)', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 800, cursor: busy ? 'wait' : 'pointer' }}>
              {busy ? 'שומר...' : 'הבנתי — שמור'}
            </button>
          )}
          <button type="button" onClick={onCancel} disabled={busy}
            style={{ background: '#f5efe4', color: '#5b331a', border: '1px solid #e2cfa9', borderRadius: 12, padding: '10px 20px', fontWeight: 800, cursor: 'pointer' }}>
            {canConfirm ? 'ביטול' : 'חזרה'}
          </button>
        </div>
      </div>
    </div>
  );
}
