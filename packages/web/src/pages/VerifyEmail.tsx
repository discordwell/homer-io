import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { C, F } from '../theme.js';

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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: C.bg,
    }}>
      <div style={{
        background: C.bg2, padding: 40, borderRadius: 16,
        border: `1px solid ${C.muted}`, width: 400, maxWidth: '90vw',
        textAlign: 'center',
      }}>
        <h1 style={{ fontFamily: F.display, fontSize: 28, marginBottom: 8, color: C.accent }}>
          HOMER.io
        </h1>
        <p style={{ color: C.dim, marginBottom: 32 }}>Email Verification</p>

        {status === 'loading' && (
          <p style={{ color: C.dim, fontSize: 15 }}>Verifying your email...</p>
        )}

        {status === 'success' && (
          <div>
            <div style={{
              background: 'rgba(52,211,153,0.1)', border: `1px solid ${C.green}`,
              color: C.green, padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              Your email has been verified successfully!
            </div>
            <Link to="/login" style={{
              display: 'inline-block', padding: '12px 32px', borderRadius: 10,
              background: C.accent, color: '#fff', textDecoration: 'none',
              fontSize: 15, fontWeight: 600, fontFamily: F.body,
            }}>
              Sign In
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{
              background: 'rgba(248,113,113,0.1)', border: `1px solid ${C.red}`,
              color: C.red, padding: 16, borderRadius: 8, marginBottom: 24, fontSize: 14,
            }}>
              {error}
            </div>
            <p style={{ color: C.dim, fontSize: 14 }}>
              <Link to="/login" style={{ color: C.accent, textDecoration: 'none' }}>
                Back to sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
