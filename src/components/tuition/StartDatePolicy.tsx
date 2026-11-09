import { START_DATE_POLICY } from '../../constants/tuitionPolicy';

/** The written start-date policy (single source: constants/tuitionPolicy.ts). */
export default function StartDatePolicy({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ background: '#fffaf0', border: '1px solid #ecd9b4', borderRadius: 12, padding: compact ? '10px 14px' : '14px 18px', textAlign: 'right' }}>
      <div style={{ fontWeight: 900, color: '#5a3420', marginBottom: 6, fontSize: compact ? 13 : 14 }}>מדיניות תאריך תחילת גבייה</div>
      <ol style={{ margin: 0, paddingInlineStart: 20, color: '#5b331a', fontSize: compact ? 12.5 : 13.5, lineHeight: 1.6 }}>
        {START_DATE_POLICY.map((p) => <li key={p}>{p}</li>)}
      </ol>
    </div>
  );
}
