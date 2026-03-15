import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { C, F } from '../theme.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: C.bg,
    }}>
      <div style={{
        background: C.bg2, padding: 40, borderRadius: 16,
        border: `1px solid ${C.muted}`, width: 400, maxWidth: '90vw',
      }}>
        <h1 style={{ fontFamily: F.display, fontSize: 28, marginBottom: 8, color: C.accent }}>
          HOMER.io
        </h1>
        <p style={{ color: C.dim, marginBottom: 32 }}>Reset your password</p>

        {sent ? (
          <div>
            <div style={{
              background: 'rgba(52,211,153,0.1)', border: `1px solid ${C.green}`,
              color: C.green, padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              If an account exists with that email, we've sent a password reset link. Check your inbox.
            </div>
            <p style={{ textAlign: 'center', color: C.dim, fontSize: 14 }}>
              <Link to="/login" style={{ color: C.accent, textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={{
              background: 'rgba(248,113,113,0.1)', border: `1px solid ${C.red}`,
              color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
            }}>{error}</div>}

            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoFocus style={inputStyle} />
            </label>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 14, borderRadius: 10,
              background: C.accent, color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              fontFamily: F.body, opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, color: C.dim, fontSize: 14 }}>
              Remember your password?{' '}
              <Link to="/login" style={{ color: C.accent, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: 12, borderRadius: 8,
  background: '#0B1525', border: '1px solid #2A3F5C',
  color: '#EEF3FC', fontSize: 15, outline: 'none',
  fontFamily: "'Inter', sans-serif",
  boxSizing: 'border-box',
};
