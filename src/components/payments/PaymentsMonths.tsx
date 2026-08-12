import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getMonthAggregates, getAllTransactions } from '../../api/tuitionApi';
import type { TxWithPerson } from '../../api/tuitionApi';
import { fmtMonthLabel, fmtDate, txTypeLabel } from '../tuition/TuitionSection';
import type { MonthAggregate } from '../../types/tuition';

function AlumniBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: '#5a3420',
      background: 'rgba(200,134,63,0.18)', border: '1px solid rgba(200,134,63,0.35)',
      borderRadius: 4, padding: '1px 5px', marginRight: 5, verticalAlign: 'middle',
      whiteSpace: 'nowrap',
    }}>
      בוגר
    </span>
  );
}

function MonthDetail({ billingMonth }: { billingMonth: string }) {
  const [txs, setTxs] = useState<TxWithPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAllTransactions({ billingMonth })
      .then(setTxs)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'))
      .finally(() => setLoading(false));
  }, [billingMonth]);

  if (loading) return (
    <div style={{ padding: 12, textAlign: 'center', color: '#8b6544', fontSize: 13 }}>
      <Loader2 size={14} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }} />
      טוען...
    </div>
  );
  if (error) return <p style={{ color: '#c62828', fontSize: 13, padding: 8 }}>{error}</p>;

  return (
    <div style={{ padding: '8px 14px', background: '#fffdf8', borderTop: '1px solid rgba(231,212,175,0.5)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: '#8b6544', fontWeight: 700, borderBottom: '1px solid rgba(231,212,175,0.6)' }}>
            <th style={{ padding: '5px 8px', textAlign: 'right' }}>תאריך</th>
            <th style={{ padding: '5px 8px', textAlign: 'right' }}>תלמיד</th>
            <th style={{ padding: '5px 8px', textAlign: 'right' }}>סוג</th>
            <th style={{ padding: '5px 8px', textAlign: 'left' }}>סכום</th>
            <th style={{ padding: '5px 8px', textAlign: 'right' }}>מקור</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => (
            <tr key={tx.id} style={{ borderBottom: '1px solid rgba(231,212,175,0.25)' }}>
              <td style={{ padding: '5px 8px', color: '#8b6544' }}>{fmtDate(tx.transactionDate)}</td>
              <td style={{ padding: '5px 8px', fontWeight: 600, color: '#4c2415' }}>
                {tx.isAlumni && <AlumniBadge />}
                {tx.studentName ?? tx.studentId}
              </td>
              <td style={{ padding: '5px 8px', color: '#5a3420' }}>{txTypeLabel(tx.transactionType)}</td>
              <td style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700, direction: 'ltr', color: tx.amount < 0 ? '#c62828' : '#2e7d32' }}>
                {tx.amount < 0 ? '-' : '+'}{Math.abs(tx.amount).toLocaleString('he-IL')} {tx.currency === 'ILS' ? '₪' : '$'}
              </td>
              <td style={{ padding: '5px 8px', color: '#8b6544' }}>{tx.source === 'automatic' ? 'אוטומטי' : 'ידני'}</td>
            </tr>
          ))}
          {txs.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 12, color: '#8b6544' }}>אין תנועות</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function fmt(n: number, sym: string) {
  return n > 0 ? `${n.toLocaleString('he-IL')} ${sym}` : '—';
}

export default function PaymentsMonths() {
  const [months, setMonths] = useState<MonthAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  useEffect(() => {
    getMonthAggregates()
      .then(setMonths)
      .catch((e) => setError(e instanceof Error ? e.message : 'שגיאה'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#8b6544' }}>
      <Loader2 size={20} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }} />
      טוען חודשים...
    </div>
  );
  if (error) return <p style={{ color: '#c62828', textAlign: 'center' }}>{error}</p>;
  if (months.length === 0) return <p style={{ textAlign: 'center', color: '#8b6544', padding: 24 }}>אין נתוני חודשים</p>;

  return (
    <div style={{ direction: 'rtl' }}>
      {months.map((m) => {
        const isOpen = openMonth === m.billingMonth;
        return (
          <div key={m.billingMonth} style={{ border: '1px solid rgba(231,212,175,0.8)', borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
            <button
              onClick={() => setOpenMonth(isOpen ? null : m.billingMonth)}
              style={{
                width: '100%', display: 'grid',
                gridTemplateColumns: '1.4fr 0.7fr 1fr 1fr 1fr 1fr 0.7fr 0.7fr auto',
                gap: 6, padding: '11px 16px',
                background: 'rgba(255,253,248,0.95)', border: 'none', cursor: 'pointer',
                textAlign: 'center', alignItems: 'center', fontSize: 13, fontWeight: 700,
                color: '#5a3420', direction: 'rtl',
              }}
            >
              <span style={{ textAlign: 'right' }}>{fmtMonthLabel(m.billingMonth)}</span>
              <span style={{ color: '#8b6544' }}>{m.countStudents} תלמידים</span>
              <span style={{ color: '#c62828' }}>{fmt(m.chargesILS, '₪')}</span>
              <span style={{ color: '#c62828' }}>{fmt(m.chargesUSD, '$')}</span>
              <span style={{ color: '#2e7d32' }}>{fmt(m.creditsILS, '₪')}</span>
              <span style={{ color: '#2e7d32' }}>{fmt(m.creditsUSD, '$')}</span>
              <span style={{ color: '#8b6544', fontSize: 12 }}>אוטו׳: {m.countAutomatic}</span>
              <span style={{ color: '#8b6544', fontSize: 12 }}>ידני: {m.countManual}</span>
              <span style={{ color: '#8b6544' }}>{isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
            </button>
            {isOpen && <MonthDetail billingMonth={m.billingMonth} />}
          </div>
        );
      })}
    </div>
  );
}
