import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import type { AuthResponse } from '@homer-io/shared';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
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

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Sign in to your account</p>

        {error && <div className="error-box">{error}</div>}

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
