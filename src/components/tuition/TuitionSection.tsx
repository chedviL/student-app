import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Loader2, Pencil, Trash2, Check } from 'lucide-react';
import { useStudentTuition, useMonthTransactions } from '../../hooks/useStudentTuition';
import type { TuitionCurrency, TransactionType, NewManualTransaction, TuitionTransaction } from '../../types/tuition';

// ── helpers ──────────────────────────────────────────────────────────────────

export function fmtAmount(amount: number, currency: TuitionCurrency) {
  const abs = Math.abs(amount).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const sym = currency === 'ILS' ? '₪' : '$';
  return amount < 0 ? `-${abs} ${sym}` : amount === 0 ? `0 ${sym}` : `+${abs} ${sym}`;
}

export function fmtMonthLabel(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

export function fmtDate(isoDate: string) {
  const d = new Date(isoDate + 'T00:00:00');
  return d.toLocaleDateString('he-IL');
}

export function txTypeLabel(type: TransactionType): string {
  switch (type) {
    case 'monthly_charge':    return 'חיוב שכ"ל חודשי';
    case 'automatic_payment': return 'תשלום אוטומטי';
    case 'manual_payment':    return 'תשלום ידני';
    case 'manual_charge':     return 'חיוב ידני';
    case 'adjustment':        return 'התאמה';
  }
}

export function firstOfMonth(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

// ── MonthRow ──────────────────────────────────────────────────────────────────

export function MonthRow({
  studentId, billingMonth, charges, credits, monthlyTotal, balanceAfterMonth, currency,
  onEdit, onDelete,
}: {
  studentId: string;
  billingMonth: string;
  charges: number | null;
  credits: number | null;
  monthlyTotal: number;
  balanceAfterMonth: number;
  currency: TuitionCurrency;
  onEdit?: (id: string, fields: Partial<Pick<NewManualTransaction, 'amount' | 'transactionDate' | 'billingMonth' | 'transactionType' | 'note'>>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const { transactions, loading } = useMonthTransactions(studentId, open ? billingMonth : null);
  const sym = currency === 'ILS' ? '₪' : '$';
  const balColor = balanceAfterMonth < 0 ? '#c62828' : '#2e7d32';

  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(231,212,175,0.9)', marginBottom: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
          gap: 8, padding: '10px 14px',
          background: 'rgba(255,253,248,0.9)',
          border: 'none', cursor: 'pointer',
          textAlign: 'center', alignItems: 'center',
          fontSize: 14, fontWeight: 700, color: '#5a3420', direction: 'rtl',
        }}
      >
        <span style={{ textAlign: 'right' }}>{fmtMonthLabel(billingMonth)}</span>
        <span style={{ color: '#c62828' }}>{charges !== null ? `${Math.abs(charges).toLocaleString('he-IL')} ${sym}-` : '—'}</span>
        <span style={{ color: '#2e7d32' }}>{credits !== null ? `${credits.toLocaleString('he-IL')} ${sym}+` : '—'}</span>
        <span style={{ color: monthlyTotal < 0 ? '#c62828' : '#2e7d32' }}>
          {monthlyTotal >= 0 ? (monthlyTotal > 0 ? '+' : '') : ''}{monthlyTotal.toLocaleString('he-IL')} {sym}
        </span>
        <span style={{ color: balColor, minWidth: 90, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}>
          {balanceAfterMonth.toLocaleString('he-IL')} {sym}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {open && (
        <div style={{ background: '#fffdf8', borderTop: '1px solid rgba(231,212,175,0.6)', padding: '8px 14px' }}>
          {loading && <p style={{ textAlign: 'center', color: '#8b6544', fontSize: 13 }}>טוען...</p>}
          {!loading && transactions.length === 0 && (
            <p style={{ textAlign: 'center', color: '#8b6544', fontSize: 13 }}>אין פעולות</p>
          )}
          {!loading && transactions.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} currency={currency} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function TransactionRow({
  tx, currency, onEdit, onDelete,
}: {
  tx: TuitionTransaction;
  currency: TuitionCurrency;
  onEdit?: (id: string, fields: Partial<Pick<NewManualTransaction, 'amount' | 'transactionDate' | 'billingMonth' | 'transactionType' | 'note'>>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState(String(tx.amount));
  const [date, setDate] = useState(tx.transactionDate);
  const [type, setType] = useState<TransactionType>(tx.transactionType);
  const [note, setNote] = useState(tx.note ?? '');
  const [err, setErr] = useState('');

  const inp: React.CSSProperties = {
    padding: '4px 8px', borderRadius: 8, border: '1.5px solid #c58a46',
    background: '#fffef9', color: '#4c2415', fontSize: 13, fontWeight: 700,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  async function save() {
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) { setErr('סכום לא תקין'); return; }
    setSaving(true); setErr('');
    try {
      if (!onEdit) return;
      await onEdit(tx.id, {
        amount: num,
        transactionDate: date,
        billingMonth: firstOfMonth(date),
        transactionType: type,
        note: note.trim() || undefined,
      });
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setDeleting(true);
    try { await onDelete(tx.id); }
    catch (e) { setErr(e instanceof Error ? e.message : 'שגיאה'); setDeleting(false); }
  }

  if (editing) {
    return (
      <div style={{ padding: '8px 0', borderBottom: '1px solid rgba(231,212,175,0.4)', direction: 'rtl' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 2 }}>סכום</label>
            <input style={{ ...inp, width: '100%' }} type="number" step="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 2 }}>תאריך</label>
            <input style={{ ...inp, width: '100%' }} type="date" value={date}
              onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 2 }}>סוג</label>
            <select style={{ ...inp, width: '100%' }} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
              <option value="manual_payment">תשלום ידני</option>
              <option value="manual_charge">חיוב ידני</option>
              <option value="adjustment">התאמה</option>
              <option value="monthly_charge">חיוב חודשי</option>
              <option value="automatic_payment">תשלום אוטומטי</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 2 }}>הערה</label>
          <input style={{ ...inp, width: '100%' }} type="text" value={note}
            onChange={(e) => setNote(e.target.value)} placeholder="הערה..." />
        </div>
        {err && <p style={{ color: '#c62828', fontSize: 12, margin: '0 0 6px' }}>{err}</p>}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid #d9b980', background: '#f5f5f5', color: '#666', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
            בטל
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '4px 12px', borderRadius: 8, border: '1px solid rgba(46,125,50,0.4)', background: 'linear-gradient(180deg,#e8f5e9,#81c784)', color: '#1b5e20', fontWeight: 800, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            {saving ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
            שמור
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', borderBottom: '1px solid rgba(231,212,175,0.4)',
      direction: 'rtl', gap: 8,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#5a3420' }}>{txTypeLabel(tx.transactionType)}</div>
        <div style={{ fontSize: 12, color: '#8b6544' }}>{fmtDate(tx.transactionDate)}</div>
        {tx.note && <div style={{ fontSize: 12, color: '#8b6544', fontStyle: 'italic' }}>{tx.note}</div>}
      </div>
      <span style={{ fontWeight: 800, fontSize: 15, color: tx.amount < 0 ? '#c62828' : '#2e7d32', whiteSpace: 'nowrap' }}>
        {fmtAmount(tx.amount, currency)}
      </span>
      <div style={{ display: 'flex', gap: 4 }}>
        {onEdit && (
          <button onClick={() => setEditing(true)} title="ערוך" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b6544', padding: 4, borderRadius: 6, display: 'flex' }}>
            <Pencil size={14} />
          </button>
        )}
        {onDelete && (
          <button onClick={remove} disabled={deleting} title="מחק" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', padding: 4, borderRadius: 6, display: 'flex' }}>
            {deleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── AddPaymentForm ────────────────────────────────────────────────────────────

export function AddPaymentForm({
  studentId, currency, onAdd, onClose,
}: {
  studentId: string;
  currency: TuitionCurrency;
  onAdd: (tx: NewManualTransaction) => Promise<void>;
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState('');
  const [date, setDate]     = useState(today);
  const [type, setType]     = useState<TransactionType>('manual_payment');
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function submit() {
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) { setErr('יש להזין סכום תקין'); return; }
    if (!date) { setErr('יש לבחור תאריך'); return; }
    const finalAmount = num;
    setSaving(true);
    setErr('');
    try {
      await onAdd({
        studentId,
        billingMonth: firstOfMonth(date),
        transactionDate: date,
        amount: finalAmount,
        currency,
        transactionType: type,
        note: note.trim() || undefined,
      });
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 10,
    border: '1.5px solid #c58a46', background: '#fffef9',
    color: '#4c2415', fontSize: 14, fontWeight: 700,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{ background: '#fffdf8', border: '1px solid rgba(200,134,63,0.4)', borderRadius: 14, padding: 16, marginTop: 12, direction: 'rtl' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 3 }}>
            סכום ({currency === 'ILS' ? '₪' : '$'})
          </label>
          <input style={inp} type="number" step="0.01" value={amount}
            onChange={(e) => setAmount(e.target.value)} placeholder="0" dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 3 }}>תאריך</label>
          <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 3 }}>סוג</label>
          <select style={inp} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="manual_payment">תשלום ידני</option>
            <option value="manual_charge">חיוב ידני</option>
            <option value="adjustment">התאמה</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 3 }}>הערה (אופציונלי)</label>
          <input style={inp} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה..." />
        </div>
      </div>
      {err && <p style={{ color: '#c62828', fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid #d9b980', background: '#f5f5f5', color: '#666', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
          בטל
        </button>
        <button onClick={submit} disabled={saving} style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid rgba(46,125,50,0.4)', background: 'linear-gradient(180deg,#e8f5e9,#81c784)', color: '#1b5e20', fontWeight: 800, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          {saving && <Loader2 size={14} className="spin" />}
          {saving ? 'שומר...' : 'שמור'}
        </button>
      </div>
    </div>
  );
}

// ── TuitionSection ────────────────────────────────────────────────────────────

export default function TuitionSection({ studentId }: { studentId: string }) {
  const { balance, history, loading, error, addTransaction, editTransaction, removeTransaction } = useStudentTuition(studentId);
  const [showForm, setShowForm] = useState(false);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '18px 0', color: '#8b6544', fontSize: 14 }}>
        <Loader2 size={18} className="spin" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }} />
        טוען נתוני שכ"ל...
      </div>
    );
  }

  if (error) {
    return <p style={{ color: '#c62828', fontSize: 14, textAlign: 'center' }}>{error}</p>;
  }

  const currency = (balance?.currency ?? null) as TuitionCurrency | null;
  const sym = currency === 'USD' ? '$' : '₪';
  const bal = balance?.currentBalance ?? 0;
  const isDebt = bal < 0;

  // If currency is not yet set, show a warning instead of the balance
  if (!currency || balance?.status === 'no_currency') {
    return (
      <div style={{ marginTop: 28, direction: 'rtl' }}>
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(200,134,63,0.5),transparent)', marginBottom: 20 }} />
        <p style={{ textAlign: 'center', color: '#8b6544', fontSize: 14, padding: '12px 0',
          background: 'rgba(255,248,220,0.8)', borderRadius: 10, border: '1px solid #e3bf7f' }}>
          ⚠️ מטבע שכ"ל לא הוגדר לתלמיד זה. יש להגדיר ILS או USD לפני הפעלת מערכת השכ"ל.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 28, direction: 'rtl' }}>
      {/* divider */}
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(200,134,63,0.5),transparent)', marginBottom: 20 }} />

      {/* balance header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#8b6544', marginBottom: 4 }}>יתרת שכ"ל נוכחית</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: isDebt ? '#c62828' : '#2e7d32', direction: 'ltr', unicodeBidi: 'isolate' }}>
            {bal < 0 ? '-' : ''}{Math.abs(bal).toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} {sym}
          </div>
          <span style={{
            display: 'inline-block', marginTop: 6,
            padding: '4px 14px', borderRadius: 999,
            fontSize: 13, fontWeight: 800,
            background: isDebt ? '#c62828' : '#2e7d32', color: '#fff',
          }}>
            {isDebt ? 'חייב' : 'תקין'}
          </span>
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 12,
            border: '1px solid rgba(200,134,63,0.45)',
            background: 'linear-gradient(180deg,#f5e6c8,#e8c98a)',
            color: '#5a3420', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          הוסף תשלום
        </button>
      </div>

      {showForm && (
        <AddPaymentForm
          studentId={studentId}
          currency={currency as TuitionCurrency}
          onAdd={addTransaction}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* history */}
      {history.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#8b6544', fontSize: 14, padding: '12px 0' }}>אין היסטוריית שכ"ל</p>
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
              studentId={studentId}
              billingMonth={m.billingMonth}
              charges={m.charges}
              credits={m.credits}
              monthlyTotal={m.monthlyTotal}
              balanceAfterMonth={m.balanceAfterMonth}
              currency={m.currency}
              onEdit={editTransaction}
              onDelete={removeTransaction}
            />
          ))}
        </>
      )}
    </div>
  );
}
