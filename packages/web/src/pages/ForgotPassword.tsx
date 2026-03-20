import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';

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
    <div className="auth-page">
      <div className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Reset your password</p>

        {sent ? (
          <div>
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid var(--green)',
              color: 'var(--green)', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              If an account exists with that email, we've sent a password reset link. Check your inbox.
            </div>
            <p className="footer-text">
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="error-box">{error}</div>}

            <label>
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoFocus />
            </label>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <p className="footer-text">
              Remember your password?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
