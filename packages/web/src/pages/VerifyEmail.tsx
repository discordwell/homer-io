import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(token ? 'loading' : 'error');
  const [error, setError] = useState(token ? '' : 'Missing verification token.');

  useEffect(() => {
    if (!token) return;

    api.post('/auth/verify-email', { token })
      .then(() => {
        setStatus('success');
        setError('');
      })
      .catch((err) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [token]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Email Verification</p>

        {status === 'loading' && (
          <p style={{ color: 'var(--t2)', fontSize: 15 }}>Verifying your email...</p>
        )}

        {status === 'success' && (
          <div>
            <div style={{
              background: 'rgba(16,185,129,0.1)', border: '1px solid var(--green)',
              color: 'var(--green)', padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              Your email has been verified successfully!
            </div>
            <Link to="/login" className="btn-primary" style={{
              display: 'inline-block', padding: '12px 32px', textDecoration: 'none',
            }}>
              Sign In
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div className="error-box">{error}</div>
            <p className="footer-text">
              <Link to="/login">Back to sign in</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
