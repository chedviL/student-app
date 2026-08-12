import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2 } from 'lucide-react';
import { useStudentTuition } from '../../hooks/useStudentTuition';
import { MonthRow, AddPaymentForm, fmtAmount } from './TuitionSection';
import type { TuitionCurrency, NewManualTransaction } from '../../types/tuition';
import type { Student } from '../../types/student';

interface TuitionModalProps {
  student: Student;
  onClose: () => void;
  onTransactionAdded?: () => void;
}

export function TuitionModal({ student, onClose, onTransactionAdded }: TuitionModalProps) {
  const { balance, history, loading, error, addTransaction, editTransaction, removeTransaction } = useStudentTuition(student.id);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const currentYear = new Date().getFullYear().toString();
  const visibleHistory = showAll ? history : history.filter(m => m.billingMonth.startsWith(currentYear));
  const hasOlder = history.some(m => !m.billingMonth.startsWith(currentYear));

  const currency = (balance?.currency ?? null) as TuitionCurrency | null;
  const bal = balance?.currentBalance ?? 0;
  const isDebt = bal < 0;
  const sym = currency === 'USD' ? '$' : '₪';

  const balLabel =
    !currency || balance?.status === 'no_currency' ? 'לא הוגדר'
    : bal === 0 ? `0 ${sym}`
    : fmtAmount(bal, currency);

  const balColor =
    !currency || balance?.status === 'no_currency' ? '#8b6544'
    : isDebt ? '#c62828'
    : '#2e7d32';

  async function handleAdd(tx: NewManualTransaction) {
    await addTransaction(tx);
    setShowForm(false);
    onTransactionAdded?.();
  }

  async function handleEdit(id: string, fields: Partial<Pick<NewManualTransaction, 'amount' | 'transactionDate' | 'billingMonth' | 'transactionType' | 'note'>>) {
    await editTransaction(id, fields);
    onTransactionAdded?.();
  }

  async function handleDelete(id: string) {
    await removeTransaction(id);
    onTransactionAdded?.();
  }

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(30,15,5,0.55)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      />

      {/* Centering wrapper — clicks outside close */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.97 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 501,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px', direction: 'rtl',
        }}
      >
        {/* Modal card — scrolls internally */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 760,
            maxHeight: 'calc(100vh - 48px)',
            display: 'flex', flexDirection: 'column',
            background: '#fffdf8', borderRadius: 22,
            boxShadow: '0 24px 64px rgba(92,53,23,0.22)',
            border: '1px solid rgba(200,134,63,0.3)',
          }}
        >
          {/* Header — sticky inside the card */}
          <div style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '24px 22px',
            borderBottom: '1px solid rgba(200,134,63,0.2)',
            background: 'linear-gradient(180deg,#fffef9,#fdf6e8)',
            borderRadius: '22px 22px 0 0',
          }}>
            <div>
              <div style={{ fontSize: 13, color: '#8b6544', fontWeight: 700 }}>מצב שכ"ל</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#5a3420' }}>
                {student.lastName} {student.firstName}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#8b6544', padding: 6, borderRadius: 8,
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Body — scrolls */}
          <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: '#8b6544', fontSize: 14 }}>
                <Loader2 size={18} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }} />
                טוען נתוני שכ"ל...
              </div>
            ) : error ? (
              <p style={{ color: '#c62828', fontSize: 14, textAlign: 'center' }}>{error}</p>
            ) : (
              <>
                {(student.tuitionRank || student.tuition) && (
                  <div style={{
                    display: 'inline-flex', gap: 12, marginBottom: 16,
                    padding: '8px 14px', background: 'rgba(245,230,200,0.4)',
                    borderRadius: 12, border: '1px solid rgba(200,134,63,0.2)', direction: 'rtl',
                  }}>
                    {student.tuitionRank && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#8b6544' }}>דרוג שכ"ל</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#5a3420' }}>{student.tuitionRank}</span>
                      </div>
                    )}
                    {student.tuitionRank && student.tuition && (
                      <div style={{ width: 1, background: 'rgba(200,134,63,0.3)', alignSelf: 'stretch' }} />
                    )}
                    {student.tuition && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#8b6544' }}>שכ"ל חודשי</span>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#5a3420', direction: 'ltr', unicodeBidi: 'isolate' }}>{student.tuition}</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'flex-start',
                  justifyContent: 'space-between', flexWrap: 'wrap',
                  gap: 16, marginBottom: 20,
                }}>
                  <div>
                    <div style={{ fontSize: 38, fontWeight: 900, color: balColor, direction: 'ltr', unicodeBidi: 'isolate', lineHeight: 1.1 }}>
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

                {showForm && currency && (
                  <AddPaymentForm
                    studentId={student.id}
                    currency={currency}
                    onAdd={handleAdd}
                    onClose={() => setShowForm(false)}
                  />
                )}

                <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(200,134,63,0.4),transparent)', margin: '4px 0 16px' }} />

                <div style={{ fontSize: 15, fontWeight: 900, color: '#5a3420', marginBottom: 12 }}>
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
                    {visibleHistory.map((m) => (
                      <MonthRow
                        key={m.billingMonth}
                        studentId={student.id}
                        billingMonth={m.billingMonth}
                        charges={m.charges}
                        credits={m.credits}
                        monthlyTotal={m.monthlyTotal}
                        balanceAfterMonth={m.balanceAfterMonth}
                        currency={m.currency}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                    {!showAll && hasOlder && (
                      <button
                        onClick={() => setShowAll(true)}
                        style={{
                          width: '100%', marginTop: 8, padding: '9px 0',
                          borderRadius: 10, border: '1px dashed rgba(200,134,63,0.5)',
                          background: 'transparent', color: '#8b6544',
                          fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        טען היסטוריה קודמת ({history.length - visibleHistory.length} חודשים נוספים)
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
