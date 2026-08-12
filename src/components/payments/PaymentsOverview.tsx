import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { getAllBalances, summariseBalances, getRecentTransactions } from '../../api/tuitionApi';
import type { TxWithPerson } from '../../api/tuitionApi';
import { fmtDate, txTypeLabel } from '../tuition/TuitionSection';
import type { TuitionBalance, AllBalancesSummary } from '../../types/tuition';
import type { Student } from '../../types/student';
import ManualPaymentModal from './ManualPaymentModal';

const card: React.CSSProperties = {
  background: 'rgba(255,253,248,0.97)',
  border: '1px solid rgba(231,212,175,0.9)',
  borderRadius: 18,
  padding: '18px 22px',
  boxShadow: '0 4px 18px rgba(92,53,23,0.08)',
};

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...card, textAlign: 'center', flex: '1 1 140px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color ?? '#4c2415' }}>{value}</div>
    </div>
  );
}

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

export default function PaymentsOverview({
  students,
  onRefreshNeeded,
}: {
  students: Student[];
  onRefreshNeeded?: () => void;
}) {
  const navigate = useNavigate();
  const [balances, setBalances] = useState<TuitionBalance[]>([]);
  const [summary, setSummary] = useState<AllBalancesSummary | null>(null);
  const [recent, setRecent] = useState<TxWithPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [bals, txs] = await Promise.all([getAllBalances(), getRecentTransactions(20)]);
      setBalances(bals);
      setSummary(summariseBalances(bals));
      setRecent(txs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const needsAttention = students.filter((s) => {
    if (!s.tuitionCurrency) return true;
    const tuitionNum = parseFloat(s.tuition);
    if (tuitionNum > 0 && !s.tuitionStartDate) return true;
    return false;
  });

  const noCurrencyIds = new Set(balances.filter((b) => b.status === 'no_currency').map((b) => b.studentId));
  const attentionSet = new Set([
    ...needsAttention.map((s) => s.id),
    ...students.filter((s) => noCurrencyIds.has(s.id)).map((s) => s.id),
  ]);
  const attentionStudents = students.filter((s) => attentionSet.has(s.id));

  // attentionCount is the source of truth — derived from students directly,
  // not from tuition_balances which only contains rows for students that already
  // have a currency set (so students with no currency at all are absent from the view).
  const attentionCount = attentionStudents.length;

  function getIssue(s: Student): string {
    if (!s.tuitionCurrency) return 'מטבע לא הוגדר';
    if (noCurrencyIds.has(s.id)) return 'סטטוס no_currency';
    const tuitionNum = parseFloat(s.tuition);
    if (tuitionNum > 0 && !s.tuitionStartDate) return 'תאריך התחלה חסר';
    return 'דורש בדיקה';
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: '#8b6544' }}>
      <Loader2 size={22} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 8 }} />
      טוען נתונים...
    </div>
  );

  if (error) return <p style={{ color: '#c62828', textAlign: 'center', padding: 24 }}>{error}</p>;

  return (
    <div style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 18 }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 20px', borderRadius: 12,
            border: '1px solid rgba(200,134,63,0.45)',
            background: 'linear-gradient(180deg,#f5e6c8,#e8c98a)',
            color: '#5a3420', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          הוספת תשלום ידני
        </button>
      </div>

      {summary && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <SummaryCard label="תלמידים חייבים" value={String(summary.debtors)} color="#c62828" />
          <SummaryCard label="תלמידים תקינים" value={String(summary.ok)} color="#2e7d32" />
          <SummaryCard label="דורש טיפול" value={String(attentionCount)} color="#e65100" />
          <SummaryCard
            label="חובות ₪"
            value={summary.debtILS < 0 ? `${Math.abs(summary.debtILS).toLocaleString('he-IL')} ₪` : '0 ₪'}
            color="#c62828"
          />
          <SummaryCard
            label="חובות $"
            value={summary.debtUSD < 0 ? `${Math.abs(summary.debtUSD).toLocaleString('he-IL')} $` : '0 $'}
            color="#c62828"
          />
        </div>
      )}

      <div style={{ ...card, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#8b6544' }}>חיוב חודשי אוטומטי:</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#2e7d32', background: '#e8f5e9', padding: '3px 12px', borderRadius: 999 }}>
          מוגדר במערכת
        </span>
      </div>

      {attentionStudents.length > 0 && (
        <div style={{ ...card, marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#e65100', marginBottom: 14 }}>⚠️ דורש טיפול ({attentionStudents.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#8b6544', fontWeight: 700, borderBottom: '1px solid rgba(231,212,175,0.8)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>שם</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>ת"ז / דרכון</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>בעיה</th>
                  <th style={{ padding: '6px 10px' }}></th>
                </tr>
              </thead>
              <tbody>
                {attentionStudents.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid rgba(231,212,175,0.4)' }}>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4c2415' }}>{s.lastName} {s.firstName}</td>
                    <td style={{ padding: '7px 10px', color: '#8b6544' }}>{s.passportOrId || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#e65100', fontWeight: 700 }}>{getIssue(s)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => navigate(`/student/${s.passportOrId || s.id}/tuition`)}
                        style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(200,134,63,0.4)', background: 'linear-gradient(180deg,#f5e6c8,#e8c98a)', color: '#5a3420', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        כרטיס
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 900, color: '#5a3420', marginBottom: 14 }}>תנועות אחרונות</div>
        {recent.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#8b6544', fontSize: 14 }}>אין תנועות</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: '#8b6544', fontWeight: 700, borderBottom: '1px solid rgba(231,212,175,0.8)' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>תאריך</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>תלמיד</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>סוג</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>סכום</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>מקור</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>הערה</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid rgba(231,212,175,0.3)' }}>
                    <td style={{ padding: '7px 10px', color: '#8b6544' }}>{fmtDate(tx.transactionDate)}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#4c2415' }}>
                      {tx.isAlumni && <AlumniBadge />}
                      {tx.studentName ?? tx.studentId}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#5a3420' }}>{txTypeLabel(tx.transactionType)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 800, color: tx.amount < 0 ? '#c62828' : '#2e7d32', direction: 'ltr' }}>
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

      {showModal && (
        <ManualPaymentModal
          students={students}
          onClose={() => setShowModal(false)}
          onSaved={() => { load(); onRefreshNeeded?.(); }}
        />
      )}
    </div>
  );
}
