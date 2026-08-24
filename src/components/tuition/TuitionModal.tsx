import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { useStudentTuition } from '../../hooks/useStudentTuition';
import { MonthRow, AddPaymentForm, fmtAmount } from './TuitionSection';
import type { TuitionCurrency, NewManualTransaction, TuitionMonthSummary } from '../../types/tuition';
import type { Student } from '../../types/student';

interface TuitionModalProps {
  student: Student;
  onClose: () => void;
  onTransactionAdded?: () => void;
}

export function TuitionModal({ student, onClose, onTransactionAdded }: TuitionModalProps) {
  const { balance, history, loading, error, addTransaction, editTransaction, cancelTx, updateCurrency } = useStudentTuition(student.id);
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currencyChanging, setCurrencyChanging] = useState(false);
  const [currencyError, setCurrencyError] = useState('');

  const currentYear = new Date().getFullYear().toString();

  // Group history by year
  const historyByYear = useMemo(() => {
    const map = new Map<string, TuitionMonthSummary[]>();
    for (const m of history) {
      const y = m.billingMonth.slice(0, 4);
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(m);
    }
    // Sort years descending
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [history]);

  // Which past years are expanded
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  function toggleYear(y: string) {
    setExpandedYears(prev => {
      const next = new Set(prev);
      next.has(y) ? next.delete(y) : next.add(y);
      return next;
    });
  }

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

  async function handleChangeCurrency(newCurrency: TuitionCurrency) {
    setCurrencyChanging(true);
    setCurrencyError('');
    try {
      await updateCurrency(newCurrency);
      onTransactionAdded?.();
    } catch (e) {
      setCurrencyError(e instanceof Error ? e.message : 'שגיאה בעדכון מטבע');
    } finally {
      setCurrencyChanging(false);
    }
  }

  async function handleEdit(id: string, fields: Partial<Pick<NewManualTransaction, 'amount' | 'transactionDate' | 'billingMonth' | 'transactionType' | 'note'>>) {
    await editTransaction(id, fields);
    onTransactionAdded?.();
  }

  async function handleCancel(id: string, reason: string) {
    await cancelTx(id, reason);
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
          padding: '16px', direction: 'rtl',
        }}
      >
        {/* Modal card — scrolls internally */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 760,
            maxHeight: 'calc(100vh - 32px)',
            marginTop: 40,
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
                    flexWrap: 'wrap',
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
                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {currency && balance?.status !== 'no_currency' && (
                        <span style={{
                          padding: '4px 14px', borderRadius: 999,
                          fontSize: 13, fontWeight: 800,
                          background: isDebt ? '#c62828' : '#2e7d32', color: '#fff',
                        }}>
                          {isDebt ? 'חייב' : 'תקין'}
                        </span>
                      )}
                      {(!currency || balance?.status === 'no_currency') && (
                        <span style={{ fontSize: 12, color: '#c07000', fontWeight: 700 }}>⚠️ מטבע לא הוגדר —</span>
                      )}
                      {/* Currency toggle buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {currency && <span style={{ fontSize: 12, color: '#8b6544' }}>מטבע:</span>}
                        {(['ILS', 'USD'] as TuitionCurrency[]).map((c) => (
                          <button
                            key={c}
                            disabled={currencyChanging}
                            onClick={() => handleChangeCurrency(c)}
                            style={{
                              padding: '3px 11px', borderRadius: 999, fontSize: 12, fontWeight: 800,
                              cursor: currencyChanging ? 'not-allowed' : 'pointer',
                              border: currency === c ? '2px solid #c8863f' : '1.5px solid rgba(200,134,63,0.4)',
                              background: currency === c ? 'linear-gradient(180deg,#f5e6c8,#e8c98a)' : 'rgba(245,230,200,0.2)',
                              color: currency === c ? '#5a3420' : '#8b6544',
                              transition: 'all 0.15s',
                            }}
                          >
                            {c === 'ILS' ? '₪ שקל' : '$ דולר'}
                          </button>
                        ))}
                        {currencyChanging && <Loader2 size={13} className="spin" style={{ color: '#8b6544' }} />}
                      </div>
                      {currencyError && <span style={{ fontSize: 12, color: '#c62828' }}>{currencyError}</span>}
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

                <button
                  onClick={() => setShowHistory(v => !v)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 12, marginBottom: showHistory ? 0 : 4,
                    border: '1px solid rgba(200,134,63,0.3)',
                    background: 'rgba(245,230,200,0.35)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 900, color: '#5a3420' }}>היסטוריית שכ"ל</span>
                  {showHistory ? <ChevronUp size={16} style={{ color: '#8b6544' }} /> : <ChevronDown size={16} style={{ color: '#8b6544' }} />}
                </button>

                {showHistory && (
                  <div>
                    {historyByYear.map(([year, months]) => {
                      const isCurrent = year === currentYear;
                      const isOpen = isCurrent || expandedYears.has(year);
                      return (
                        <div key={year} style={{ marginBottom: 10 }}>
                          {/* Year header */}
                          <button
                            onClick={() => !isCurrent && toggleYear(year)}
                            style={{
                              width: '100%',
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '9px 14px',
                              borderRadius: isOpen ? '12px 12px 0 0' : 12,
                              border: `1px solid ${isCurrent ? 'rgba(200,134,63,0.45)' : 'rgba(200,134,63,0.2)'}`,
                              background: isCurrent
                                ? 'linear-gradient(180deg,#fdf6e8,#f5e6c8)'
                                : 'rgba(245,240,232,0.7)',
                              cursor: isCurrent ? 'default' : 'pointer',
                              fontFamily: 'inherit',
                            }}
                          >
                            <span style={{
                              fontSize: 14, fontWeight: 900,
                              color: isCurrent ? '#5a3420' : '#7a6040',
                            }}>
                              {isCurrent ? `${year} — שנה נוכחית` : year}
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#8b6544', marginRight: 8 }}>
                                ({months.length} חודשים)
                              </span>
                            </span>
                            {!isCurrent && (
                              isOpen
                                ? <ChevronUp size={15} style={{ color: '#8b6544' }} />
                                : <ChevronDown size={15} style={{ color: '#8b6544' }} />
                            )}
                          </button>

                          {/* Months inside year */}
                          {isOpen && (
                            <div style={{
                              border: `1px solid ${isCurrent ? 'rgba(200,134,63,0.35)' : 'rgba(200,134,63,0.18)'}`,
                              borderTop: 'none',
                              borderRadius: '0 0 12px 12px',
                              background: isCurrent ? 'rgba(255,253,248,0.98)' : 'rgba(248,246,242,0.95)',
                              padding: '8px 8px 4px',
                            }}>
                              {/* Column headers */}
                              <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
                                gap: 8, padding: '4px 14px 8px', fontSize: 11, fontWeight: 700,
                                color: '#8b6544', textAlign: 'center', direction: 'rtl',
                                borderBottom: '1px solid rgba(200,134,63,0.15)',
                                marginBottom: 6,
                              }}>
                                <span style={{ textAlign: 'right' }}>חודש</span>
                                <span>חיובים</span>
                                <span>זיכויים</span>
                                <span>סה"כ חודשי</span>
                                <span style={{ minWidth: 90, textAlign: 'left' }}>יתרה מצטברת</span>
                              </div>
                              {months.map((m) => (
                                <MonthRow
                                  key={m.billingMonth}
                                  studentId={student.id}
                                  billingMonth={m.billingMonth}
                                  charges={m.charges}
                                  credits={m.credits}
                                  monthlyTotal={m.monthlyTotal}
                                  balanceAfterMonth={m.balanceAfterMonth}
                                  currency={m.currency}
                                  studentName={`${student.lastName} ${student.firstName}`}
                                  onEdit={handleEdit}
                                  onCancel={handleCancel}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
