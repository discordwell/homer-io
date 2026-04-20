import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(() => (
    token ? '' : 'Missing reset token. Please use the link from your email.'
  ));
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
    <div className="auth-page">
      <div className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Set your new password</p>

        {success ? (
          <div>
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid var(--green)',
              color: 'var(--green)', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              Your password has been reset successfully.
            </div>
            <p className="footer-text">
              <Link to="/login">Sign in with your new password</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-box">{error}</div>}

            <label>
              <span>New Password</span>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                required autoFocus minLength={8} />
            </label>

            <label>
              <span>Confirm Password</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required minLength={8} />
            </label>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>

            <p className="footer-text">
              <Link to="/login">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
