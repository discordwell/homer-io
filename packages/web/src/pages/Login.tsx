import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import { GoogleSignInButton } from '../components/GoogleSignInButton.js';
import type { AuthResponse, GoogleAuthResponse } from '@homer-io/shared';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPendingGoogleUser = useAuthStore((s) => s.setPendingGoogleUser);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post<AuthResponse>('/auth/login', { email, password });
      setAuth(res);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError('');
    try {
      const res = await api.post<GoogleAuthResponse>('/auth/google', { credential });
      if (res.status === 'existing_user' && res.auth) {
        setAuth(res.auth);
        navigate('/dashboard');
      } else if (res.status === 'new_user') {
        setPendingGoogleUser({
          credential,
          email: res.googleEmail!,
          name: res.googleName!,
          orgOptions: res.orgOptions || [],
        });
        navigate('/org-choice');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Sign in to your account</p>

        {error && <div className="error-box">{error}</div>}

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={setError}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
          <span style={{ color: '#888', fontSize: 13 }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
        </div>

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required autoFocus />
        </label>

        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required />
        </label>

        <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <p className="footer-text">
          Don't have an account?{' '}
          <Link to="/register">Create one</Link>
        </p>
      </form>
    </div>
  );
}
