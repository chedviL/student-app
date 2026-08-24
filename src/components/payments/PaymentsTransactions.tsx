import { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { getAllTransactions } from '../../api/tuitionApi';
import type { TxWithPerson } from '../../api/tuitionApi';
import { fmtDate, txTypeLabel } from '../tuition/TuitionSection';
import type { TransactionType } from '../../types/tuition';
import type { Student } from '../../types/student';

const TX_TYPES: { value: string; label: string }[] = [
  { value: '', label: 'כל הסוגים' },
  { value: 'monthly_charge', label: 'חיוב שכ"ל' },
  { value: 'automatic_payment', label: 'תשלום אוטומטי' },
  { value: 'manual_payment', label: 'תשלום ידני' },
  { value: 'manual_charge', label: 'חיוב ידני' },
  { value: 'adjustment', label: 'התאמה' },
];

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

export default function PaymentsTransactions({ students }: { students: Student[] }) {
  const [txs, setTxs] = useState<TxWithPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchStudent, setSearchStudent] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllTransactions({
        currency: filterCurrency || undefined,
        transactionType: filterType as TransactionType || undefined,
        source: filterSource || undefined,
        billingMonth: filterMonth || undefined,
      });
      setTxs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, [filterCurrency, filterType, filterSource, filterMonth]);

  useEffect(() => { load(); }, [load]);

  const studentMap = new Map(students.map((s) => [s.id, s]));

  const displayed = txs.filter((tx) => {
    if (!searchStudent) return true;
    const q = searchStudent.toLowerCase();
    const name = tx.studentName ?? '';
    const st = studentMap.get(tx.studentId);
    return name.toLowerCase().includes(q) || (st?.passportOrId ?? '').includes(q);
  });

  const inp: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 10, border: '1.5px solid rgba(200,134,63,0.4)',
    background: '#fffef9', color: '#4c2415', fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <input style={{ ...inp, flex: '1 1 160px' }} placeholder="חיפוש תלמיד / בוגר" value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} />
        <input style={{ ...inp, width: 140 }} type="month" value={filterMonth ? filterMonth.slice(0, 7) : ''} onChange={(e) => setFilterMonth(e.target.value ? e.target.value + '-01' : '')} dir="ltr" />
        <select style={inp} value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}>
          <option value="">כל המטבעות</option>
          <option value="ILS">₪ שקל</option>
          <option value="USD">$ דולר</option>
        </select>
        <select style={inp} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          {TX_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select style={inp} value={filterSource} onChange={(e) => setFilterSource(e.target.value)}>
          <option value="">כל המקורות</option>
          <option value="automatic">אוטומטי</option>
          <option value="manual">ידני</option>
        </select>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#8b6544' }}>
          <Loader2 size={20} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }} />
          טוען תנועות...
        </div>
      )}
      {error && <p style={{ color: '#c62828', textAlign: 'center' }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
          <div style={{ fontSize: 12, color: '#8b6544', marginBottom: 8 }}>{displayed.length} תנועות</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ color: '#8b6544', fontWeight: 700, borderBottom: '2px solid rgba(231,212,175,0.9)' }}>
                <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>תאריך</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>חודש חיוב</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>תלמיד</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>סוג</th>
                <th style={{ padding: '8px 10px', textAlign: 'left',  position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>סכום</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>מקור</th>
                <th style={{ padding: '8px 10px', textAlign: 'right', position: 'sticky', top: 0, background: 'rgba(255,253,248,0.97)', zIndex: 2 }}>הערה</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#8b6544' }}>לא נמצאו תנועות</td></tr>
              )}
              {displayed.map((tx) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(231,212,175,0.3)' }}>
                  <td style={{ padding: '7px 10px', color: '#8b6544' }}>{fmtDate(tx.transactionDate)}</td>
                  <td style={{ padding: '7px 10px', color: '#8b6544', direction: 'ltr' }}>{tx.billingMonth.slice(0, 7)}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4c2415' }}>
                    {tx.isAlumni && <AlumniBadge />}
                    {tx.studentName ?? tx.studentId}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#5a3420' }}>{txTypeLabel(tx.transactionType)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 800, direction: 'ltr', color: tx.amount < 0 ? '#c62828' : '#2e7d32' }}>
                    {tx.amount < 0 ? '-' : '+'}{Math.abs(tx.amount).toLocaleString('he-IL')} {tx.currency === 'ILS' ? '₪' : '$'}
                  </td>
                  <td style={{ padding: '7px 10px', color: '#8b6544', fontSize: 12 }}>{tx.source === 'automatic' ? 'אוטומטי' : 'ידני'}</td>
                  <td style={{ padding: '7px 10px', color: '#8b6544', fontSize: 12, fontStyle: 'italic' }}>{tx.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
