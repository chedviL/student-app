import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/logo.png';

export default function SetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6)        { setError('הסיסמה חייבת להכיל לפחות 6 תווים'); return; }
    if (password !== confirm)        { setError('הסיסמאות אינן תואמות'); return; }
    setLoading(true);
    setError('');
    const err = await updatePassword(password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: 12,
    border: '1.5px solid #e7d4af', background: '#fffdf8',
    color: '#4c2415', fontSize: 14, fontWeight: 600,
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', direction: 'rtl', padding: 16,
      background: 'radial-gradient(circle at top center, rgba(255,244,219,0.95), transparent 34%), linear-gradient(180deg, #fbf6eb 0%, #f3e6cd 100%)',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'rgba(255,253,248,0.96)', borderRadius: 28,
        boxShadow: '0 24px 60px rgba(92,53,23,0.13), 0 0 0 1px rgba(220,180,110,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
        border: '1px solid rgba(231,212,175,0.9)', padding: '40px 32px 36px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 2, borderRadius: 999,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,120,0.8) 30%, rgba(255,195,60,1) 50%, rgba(255,215,120,0.8) 70%, transparent 100%)',
          boxShadow: '0 0 14px rgba(255,200,80,0.5)',
        }} />

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src={logo} alt="לוגו" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 14, filter: 'drop-shadow(0 6px 16px rgba(160,104,40,0.22))' }} />
          <div style={{ fontSize: 20, fontWeight: 900, color: '#4c2415', letterSpacing: '0.01em' }}>ישיבת פני מנחם</div>
          <div style={{ fontSize: 13, color: '#c8863f', fontWeight: 700, marginTop: 4, letterSpacing: '0.04em' }}>הגדרת סיסמה</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8b6544', marginBottom: 6 }}>סיסמה חדשה</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password" dir="ltr" placeholder="לפחות 6 תווים"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#c8863f'; e.target.style.boxShadow = '0 0 0 4px rgba(200,134,63,0.12)'; }}
              onBlur={e  => { e.target.style.borderColor = '#e7d4af'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          <div style={{ marginBottom: 22 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#8b6544', marginBottom: 6 }}>אימות סיסמה</label>
            <input
              type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" dir="ltr" placeholder="••••••••"
              style={inputStyle}
              onFocus={e => { e.target.style.borderColor = '#c8863f'; e.target.style.boxShadow = '0 0 0 4px rgba(200,134,63,0.12)'; }}
              onBlur={e  => { e.target.style.borderColor = '#e7d4af'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 12,
              background: '#fdecea', border: '1px solid #ef9a9a',
              color: '#7f1616', fontSize: 13, fontWeight: 700, textAlign: 'center',
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px', borderRadius: 999,
              background: loading ? '#e8d5b0' : 'linear-gradient(180deg, #faecc4 0%, #d9a84e 100%)',
              color: '#3a1e08', fontWeight: 800, fontSize: 15,
              border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: loading ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 14px rgba(160,104,40,0.25)',
              letterSpacing: '0.03em', transition: 'opacity 0.15s',
            }}
          >
            {loading && <Loader2 size={15} className="spin" />}
            {loading ? 'שומר...' : 'שמור סיסמה וכנס'}
          </button>
        </form>
      </div>
    </div>
  );
}
