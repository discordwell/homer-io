import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { C, F } from '../theme.js';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
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
        <p style={{ color: C.dim, marginBottom: 32 }}>Set your new password</p>

        {success ? (
          <div>
            <div style={{
              background: 'rgba(52,211,153,0.1)', border: `1px solid ${C.green}`,
              color: C.green, padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              Your password has been reset successfully.
            </div>
            <p style={{ textAlign: 'center', color: C.dim, fontSize: 14 }}>
              <Link to="/login" style={{ color: C.accent, textDecoration: 'none' }}>
                Sign in with your new password
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div style={{
              background: 'rgba(248,113,113,0.1)', border: `1px solid ${C.red}`,
              color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
            }}>{error}</div>}

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>New Password</span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                required autoFocus style={inputStyle} minLength={8} />
            </label>

            <label style={{ display: 'block', marginBottom: 24 }}>
              <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Confirm Password</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required style={inputStyle} minLength={8} />
            </label>

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: 14, borderRadius: 10,
              background: C.accent, color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
              fontFamily: F.body, opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <p style={{ textAlign: 'center', marginTop: 20, color: C.dim, fontSize: 14 }}>
              <Link to="/login" style={{ color: C.accent, textDecoration: 'none' }}>
                Back to sign in
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
