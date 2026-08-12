import { useState, useMemo } from 'react';
import { Loader2, X } from 'lucide-react';
import { addManualTransaction } from '../../api/tuitionApi';
import { firstOfMonth } from '../tuition/TuitionSection';
import type { Student } from '../../types/student';
import type { TransactionType, TuitionCurrency } from '../../types/tuition';

export default function ManualPaymentModal({
  students,
  onClose,
  onSaved,
  preselectedStudentId,
}: {
  students: Student[];
  onClose: () => void;
  onSaved: () => void;
  preselectedStudentId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [studentId, setStudentId] = useState(preselectedStudentId ?? '');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [type, setType] = useState<TransactionType>('manual_payment');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  const filteredStudents = useMemo(() => {
    if (!search) return students;
    const q = search.toLowerCase();
    return students.filter((s) =>
      `${s.lastName} ${s.firstName}`.toLowerCase().includes(q) || s.passportOrId.includes(q)
    );
  }, [students, search]);

  const selectedStudent = students.find((s) => s.id === studentId);
  const currency = selectedStudent?.tuitionCurrency as TuitionCurrency | null | undefined;
  const sym = currency === 'USD' ? '$' : '₪';

  async function submit() {
    if (!studentId) { setErr('יש לבחור תלמיד'); return; }
    if (!currency) { setErr('לתלמיד זה אין מטבע מוגדר'); return; }
    const num = parseFloat(amount);
    if (isNaN(num) || num === 0) { setErr('יש להזין סכום תקין'); return; }
    if (!date) { setErr('יש לבחור תאריך'); return; }

    // payment/credit → positive, manual_charge → negative
    const finalAmount = type === 'manual_charge' ? -Math.abs(num) : Math.abs(num);

    setSaving(true);
    setErr('');
    try {
      await addManualTransaction({
        studentId,
        billingMonth: firstOfMonth(date),
        transactionDate: date,
        amount: finalAmount,
        currency,
        transactionType: type,
        note: note.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 10,
    border: '1.5px solid rgba(200,134,63,0.45)', background: '#fffef9',
    color: '#4c2415', fontSize: 14, fontWeight: 600,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fffdf8', borderRadius: 20, padding: 28,
        width: '100%', maxWidth: 480, direction: 'rtl',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        border: '1px solid rgba(200,134,63,0.3)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#4c2415' }}>הוספת תשלום ידני</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b6544', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Student search + select */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 4 }}>בחירת תלמיד</label>
          <input style={inp} placeholder="חיפוש שם / ת&quot;ז..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select style={{ ...inp, marginTop: 6, height: 120 }} size={5} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— בחר תלמיד —</option>
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.lastName} {s.firstName}{s.tuitionCurrency ? ` (${s.tuitionCurrency})` : ' ⚠️'}
              </option>
            ))}
          </select>
          {selectedStudent && (
            <div style={{ fontSize: 12, color: '#8b6544', marginTop: 4 }}>
              נבחר: <strong>{selectedStudent.lastName} {selectedStudent.firstName}</strong>
              {currency ? ` · מטבע: ${currency}` : ' · ⚠️ אין מטבע'}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 4 }}>
              סכום ({sym})
            </label>
            <input style={inp} type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" dir="ltr" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 4 }}>תאריך</label>
            <input style={inp} type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 4 }}>סוג פעולה</label>
          <select style={inp} value={type} onChange={(e) => setType(e.target.value as TransactionType)}>
            <option value="manual_payment">תשלום / זיכוי (סכום חיובי)</option>
            <option value="manual_charge">חיוב ידני (סכום שלילי)</option>
            <option value="adjustment">התאמה</option>
          </select>
          <div style={{ fontSize: 11, color: '#8b6544', marginTop: 3 }}>
            {type === 'manual_charge' ? 'הסכום יישמר כשלילי (חיוב)' : 'הסכום יישמר כחיובי (זיכוי/תשלום)'}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#8b6544', display: 'block', marginBottom: 4 }}>הערה (אופציונלי)</label>
          <input style={inp} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="הערה..." />
        </div>

        {err && <p style={{ color: '#c62828', fontSize: 13, fontWeight: 700, margin: '0 0 12px' }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid #d9b980', background: '#f5f5f5', color: '#666', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            בטל
          </button>
          <button onClick={submit} disabled={saving} style={{ padding: '9px 20px', borderRadius: 10, border: '1px solid rgba(46,125,50,0.4)', background: 'linear-gradient(180deg,#e8f5e9,#81c784)', color: '#1b5e20', fontWeight: 800, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {saving && <Loader2 size={14} className="spin" />}
            {saving ? 'שומר...' : 'שמור'}
          </button>
        </div>
      </div>
    </div>
  );
}
