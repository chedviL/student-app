import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Student } from '../../types/student';
import type { TuitionBalance } from '../../types/tuition';
import ManualPaymentModal from './ManualPaymentModal';

type SortKey = 'name' | 'balance';
type FilterStatus = 'all' | 'debt' | 'ok' | 'attention';

function statusBadge(balance: TuitionBalance | undefined, student: Student) {
  if (!balance || balance.status === 'no_currency' || !student.tuitionCurrency) {
    return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#fff3e0', color: '#e65100' }}>דורש טיפול</span>;
  }
  if (balance.currentBalance < 0) {
    return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#ffebee', color: '#c62828' }}>חייב</span>;
  }
  return <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: '#e8f5e9', color: '#2e7d32' }}>תקין</span>;
}

export default function PaymentsStudentsTable({
  students,
  balances,
  onRefreshNeeded,
}: {
  students: Student[];
  balances: TuitionBalance[];
  onRefreshNeeded?: () => void;
}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCurrency, setFilterCurrency] = useState('');
  const [filterRank, setFilterRank] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const balanceMap = useMemo(() => {
    const m = new Map<string, TuitionBalance>();
    for (const b of balances) m.set(b.studentId, b);
    return m;
  }, [balances]);

  const ranks = useMemo(() => [...new Set(students.map((s) => s.tuitionRank).filter(Boolean))].sort(), [students]);

  const filtered = useMemo(() => {
    let list = students.filter((s) => {
      const q = search.toLowerCase();
      if (q && !`${s.lastName} ${s.firstName}`.toLowerCase().includes(q) && !s.passportOrId.includes(q)) return false;
      if (filterCurrency && s.tuitionCurrency !== filterCurrency) return false;
      if (filterRank && s.tuitionRank !== filterRank) return false;
      const bal = balanceMap.get(s.id);
      if (filterStatus === 'debt') return bal && bal.currentBalance < 0;
      if (filterStatus === 'ok') return bal && bal.currentBalance >= 0 && bal.status !== 'no_currency';
      if (filterStatus === 'attention') return !s.tuitionCurrency || (bal && bal.status === 'no_currency');
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === 'balance') {
        const ba = balanceMap.get(a.id)?.currentBalance ?? 0;
        const bb = balanceMap.get(b.id)?.currentBalance ?? 0;
        return sortAsc ? ba - bb : bb - ba;
      }
      const cmp = `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'he');
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [students, search, filterStatus, filterCurrency, filterRank, sortKey, sortAsc, balanceMap]);

  const inp: React.CSSProperties = {
    padding: '7px 12px', borderRadius: 10, border: '1.5px solid rgba(200,134,63,0.4)',
    background: '#fffef9', color: '#4c2415', fontSize: 13, fontWeight: 600,
    fontFamily: 'inherit', outline: 'none',
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  return (
    <div style={{ direction: 'rtl' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <input style={{ ...inp, flex: '1 1 180px' }} placeholder="חיפוש שם / ת&quot;ז" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select style={inp} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}>
          <option value="all">כולם</option>
          <option value="debt">חייבים</option>
          <option value="ok">תקינים</option>
          <option value="attention">דורש טיפול</option>
        </select>
        <select style={inp} value={filterCurrency} onChange={(e) => setFilterCurrency(e.target.value)}>
          <option value="">כל המטבעות</option>
          <option value="ILS">₪ שקל</option>
          <option value="USD">$ דולר</option>
        </select>
        {ranks.length > 0 && (
          <select style={inp} value={filterRank} onChange={(e) => setFilterRank(e.target.value)}>
            <option value="">כל הדירוגים</option>
            {ranks.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10,
            border: '1px solid rgba(200,134,63,0.45)',
            background: 'linear-gradient(180deg,#f5e6c8,#e8c98a)',
            color: '#5a3420', fontWeight: 800, fontSize: 13, cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          תשלום ידני
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ color: '#8b6544', fontWeight: 700, borderBottom: '2px solid rgba(231,212,175,0.9)', background: 'rgba(255,253,248,0.8)' }}>
              <th
                style={{ padding: '8px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('name')}
              >
                שם {sortKey === 'name' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>ת"ז / דרכון</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>שכ"ל חודשי</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>מטבע</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>דירוג</th>
              <th
                style={{ padding: '8px 12px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                onClick={() => toggleSort('balance')}
              >
                יתרה {sortKey === 'balance' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#8b6544' }}>לא נמצאו תלמידים</td></tr>
            )}
            {filtered.map((s) => {
              const bal = balanceMap.get(s.id);
              const sym = s.tuitionCurrency === 'USD' ? '$' : '₪';
              const balVal = bal?.currentBalance;
              return (
                <tr
                  key={s.id}
                  onClick={() => navigate(`/student/${s.passportOrId || s.id}/tuition`)}
                  style={{ borderBottom: '1px solid rgba(231,212,175,0.35)', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,248,230,0.7)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#4c2415' }}>{s.lastName} {s.firstName}</td>
                  <td style={{ padding: '9px 12px', color: '#8b6544' }}>{s.passportOrId || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#5a3420' }}>{s.tuition ? `${s.tuition} ${sym}` : '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#5a3420' }}>{s.tuitionCurrency || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#8b6544' }}>{s.tuitionRank || '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 800, direction: 'ltr', color: balVal === undefined ? '#8b6544' : balVal < 0 ? '#c62828' : '#2e7d32' }}>
                    {balVal === undefined ? '—' : `${balVal < 0 ? '-' : '+'}${Math.abs(balVal).toLocaleString('he-IL')} ${sym}`}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>{statusBadge(bal, s)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <ManualPaymentModal
          students={students}
          onClose={() => setShowModal(false)}
          onSaved={() => onRefreshNeeded?.()}
        />
      )}
    </div>
  );
}
