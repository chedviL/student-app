/**
 * CancelTransactionModal
 * Confirms cancellation of a tuition transaction with a mandatory reason.
 * Shows: student name, transaction type, date, amount, currency.
 * After confirmation calls onConfirm(reason) — caller handles the RPC.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { fmtAmount, fmtDate, txTypeLabel } from './TuitionSection';
import type { TuitionTransaction, TuitionCurrency } from '../../types/tuition';

interface CancelTransactionModalProps {
  transaction: TuitionTransaction;
  studentName: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

export default function CancelTransactionModal({
  transaction,
  studentName,
  onConfirm,
  onClose,
}: CancelTransactionModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const currency = transaction.currency as TuitionCurrency;

  async function handleConfirm() {
    if (!reason.trim()) {
      setErr('יש להזין סיבת ביטול');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שגיאה בביטול הפעולה');
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10,
    border: '1.5px solid rgba(200,134,63,0.45)', background: '#fffef9',
    color: '#4c2415', fontSize: 14, fontWeight: 600,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    resize: 'vertical' as const,
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        key="cancel-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 600,
          background: 'rgba(30,15,5,0.6)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      <motion.div
        key="cancel-modal"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 601,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, direction: 'rtl',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 460,
            background: '#fffdf8', borderRadius: 20,
            boxShadow: '0 20px 60px rgba(92,53,23,0.25)',
            border: '1px solid rgba(200,134,63,0.3)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px',
            background: 'linear-gradient(180deg,#fff8f0,#fdeede)',
            borderBottom: '1px solid rgba(200,134,63,0.2)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={20} style={{ color: '#c62828', flexShrink: 0 }} />
              <span style={{ fontSize: 17, fontWeight: 900, color: '#4c2415' }}>
                ביטול פעולה
              </span>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b6544', padding: 4, display: 'flex' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '18px 20px' }}>
            {/* Transaction details */}
            <div style={{
              background: 'rgba(255,240,230,0.5)', border: '1px solid rgba(198,40,40,0.2)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 16, direction: 'rtl',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', marginBottom: 8 }}>
                פרטי הפעולה שתבוטל:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: 13 }}>
                <div>
                  <span style={{ color: '#8b6544' }}>תלמיד: </span>
                  <strong style={{ color: '#4c2415' }}>{studentName}</strong>
                </div>
                <div>
                  <span style={{ color: '#8b6544' }}>סוג: </span>
                  <strong style={{ color: '#4c2415' }}>{txTypeLabel(transaction.transactionType)}</strong>
                </div>
                <div>
                  <span style={{ color: '#8b6544' }}>תאריך: </span>
                  <strong style={{ color: '#4c2415' }}>{fmtDate(transaction.transactionDate)}</strong>
                </div>
                <div>
                  <span style={{ color: '#8b6544' }}>סכום: </span>
                  <strong style={{
                    color: transaction.amount < 0 ? '#c62828' : '#2e7d32',
                    direction: 'ltr', unicodeBidi: 'isolate' as const,
                  }}>
                    {fmtAmount(transaction.amount, currency)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Warning */}
            <p style={{
              fontSize: 13, color: '#c62828', fontWeight: 700,
              background: 'rgba(198,40,40,0.07)', border: '1px solid rgba(198,40,40,0.2)',
              borderRadius: 8, padding: '8px 12px', margin: '0 0 14px',
            }}>
              ⚠️ פעולה זו תשפיע על יתרת השכ"ל של התלמיד. הפעולה לא תימחק אלא תסומן כמבוטלת.
            </p>

            {/* Reason */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                fontSize: 13, fontWeight: 800, color: '#4c2415',
                display: 'block', marginBottom: 6,
              }}>
                סיבת הביטול <span style={{ color: '#c62828' }}>*</span>
              </label>
              <textarea
                rows={3}
                style={{ ...inp, minHeight: 72 }}
                placeholder="לדוגמה: לא היה כיסוי / פעולה הוזנה בטעות / תשלום בוטל..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
              <div style={{ fontSize: 11, color: '#8b6544', marginTop: 3 }}>
                חובה — הסיבה תישמר לצרכי ביקורת
              </div>
            </div>

            {err && (
              <p style={{ color: '#c62828', fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>
                {err}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  border: '1px solid #d9b980', background: '#f5f5f5',
                  color: '#666', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                }}
              >
                חזרה
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving || !reason.trim()}
                style={{
                  padding: '9px 20px', borderRadius: 10,
                  border: '1px solid rgba(198,40,40,0.4)',
                  background: saving || !reason.trim()
                    ? '#f5f5f5'
                    : 'linear-gradient(180deg,#ffebee,#ef9a9a)',
                  color: saving || !reason.trim() ? '#aaa' : '#b71c1c',
                  fontWeight: 800, cursor: saving || !reason.trim() ? 'not-allowed' : 'pointer',
                  fontSize: 14, display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {saving && <Loader2 size={14} className="spin" />}
                {saving ? 'מבטל...' : 'אשר ביטול'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
