import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, Loader2 } from 'lucide-react';
import { useStudents } from '../context/StudentsContext';
import { useStudentTuition } from '../hooks/useStudentTuition';
import {
  MonthRow,
  AddPaymentForm,
  fmtAmount,
} from '../components/tuition/TuitionSection';
import type { TuitionCurrency, NewManualTransaction } from '../types/tuition';

export default function TuitionPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { students } = useStudents();
  const student = students.find(
    (s) => String(s.passportOrId || s.id || '') === String(studentId || '')
  ) ?? null;

  const { balance, history, loading, error, addTransaction } = useStudentTuition(
    student?.id ?? ''
  );
  const [showForm, setShowForm] = useState(false);

  const currency = (balance?.currency ?? null) as TuitionCurrency | null;
  const bal = balance?.currentBalance ?? 0;
  const isDebt = bal < 0;
  const sym = currency === 'USD' ? '$' : '₪';

  const balLabel =
    !currency || balance?.status === 'no_currency'
      ? 'לא הוגדר'
      : bal === 0
      ? `0 ${sym}`
      : fmtAmount(bal, currency);

  const balColor =
    !currency || balance?.status === 'no_currency'
      ? '#8b6544'
      : isDebt
      ? '#c62828'
      : '#2e7d32';

  async function handleAdd(tx: NewManualTransaction) {
    await addTransaction(tx);
    setShowForm(false);
  }

  return (
    <motion.div
      className="search-page with-navbar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ direction: 'rtl' }}
    >
      <div className="search-shell" style={{ maxWidth: 780 }}>

        {/* ── Back ── */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#8b6544', fontWeight: 700, fontSize: 14, marginBottom: 18,
            padding: 0,
          }}
        >
          <ArrowRight size={16} />
          חזרה לכרטיס התלמיד
        </button>

        {/* ── Header card ── */}
        <div style={{
          background: 'rgba(255,253,248,0.95)',
          border: '1px solid rgba(200,134,63,0.35)',
          borderRadius: 20,
          padding: '22px 24px',
          marginBottom: 20,
          boxShadow: '0 4px 20px rgba(92,53,23,0.08)',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '18px 0', color: '#8b6544', fontSize: 14 }}>
              <Loader2 size={18} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }} />
              טוען נתוני שכ"ל...
            </div>
          ) : error ? (
            <p style={{ color: '#c62828', fontSize: 14, textAlign: 'center' }}>{error}</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#8b6544', marginBottom: 2 }}>
                  {student ? `${student.lastName} ${student.firstName}` : '—'}
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: balColor, direction: 'ltr', unicodeBidi: 'isolate', lineHeight: 1.1 }}>
                  {balLabel}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  {currency && balance?.status !== 'no_currency' && (
                    <span style={{
                      padding: '4px 14px', borderRadius: 999,
                      fontSize: 13, fontWeight: 800,
                      background: isDebt ? '#c62828' : '#2e7d32', color: '#fff',
                    }}>
                      {isDebt ? 'חייב' : 'תקין'}
                    </span>
                  )}
                  {currency && (
                    <span style={{ fontSize: 13, color: '#8b6544', fontWeight: 700 }}>
                      {currency === 'ILS' ? 'שקל ₪' : 'דולר $'}
                    </span>
                  )}
                  {(!currency || balance?.status === 'no_currency') && (
                    <span style={{ fontSize: 13, color: '#8b6544' }}>⚠️ מטבע לא הוגדר</span>
                  )}
                </div>
              </div>

              {currency && balance?.status !== 'no_currency' && (
                <button
                  onClick={() => setShowForm((v) => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '9px 18px', borderRadius: 12,
                    border: '1px solid rgba(200,134,63,0.45)',
                    background: 'linear-gradient(180deg,#f5e6c8,#e8c98a)',
                    color: '#5a3420', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  <Plus size={15} />
                  הוספת תשלום ידני
                </button>
              )}
            </div>
          )}

          {showForm && currency && student && (
            <AddPaymentForm
              studentId={student.id}
              currency={currency}
              onAdd={handleAdd}
              onClose={() => setShowForm(false)}
            />
          )}
        </div>

        {/* ── History ── */}
        {!loading && !error && (
          <div style={{
            background: 'rgba(255,253,248,0.95)',
            border: '1px solid rgba(200,134,63,0.35)',
            borderRadius: 20,
            padding: '18px 20px',
            boxShadow: '0 4px 20px rgba(92,53,23,0.08)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#5a3420', marginBottom: 14 }}>
              היסטוריית שכ"ל
            </div>

            {history.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#8b6544', fontSize: 14, padding: '12px 0' }}>
                אין היסטוריית שכ"ל
              </p>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                  gap: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700,
                  color: '#8b6544', textAlign: 'center', direction: 'rtl',
                }}>
                  <span style={{ textAlign: 'right' }}>חודש</span>
                  <span>חיובים</span>
                  <span>זיכויים</span>
                  <span>סה"כ חודשי</span>
                  <span style={{ minWidth: 90, textAlign: 'left' }}>יתרה מצטברת</span>
                </div>
                {history.map((m) => (
                  <MonthRow
                    key={m.billingMonth}
                    studentId={student?.id ?? ''}
                    billingMonth={m.billingMonth}
                    charges={m.charges}
                    credits={m.credits}
                    monthlyTotal={m.monthlyTotal}
                    balanceAfterMonth={m.balanceAfterMonth}
                    currency={m.currency}
                  />
                ))}
              </>
            )}
          </div>
        )}

      </div>
    </motion.div>
  );
}
