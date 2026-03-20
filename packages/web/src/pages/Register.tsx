import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import type { AuthResponse } from '@homer-io/shared';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
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
      const res = await api.post<AuthResponse>('/auth/register', {
        name, orgName, email, password,
      });
      setAuth(res);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form onSubmit={handleSubmit} className="auth-card">
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Create your account</p>

        {error && <div className="error-box">{error}</div>}

        <label>
          <span>Your Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            required autoFocus />
        </label>

        <label>
          <span>Organization Name</span>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
            required />
        </label>

        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required />
        </label>

        <label>
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} />
        </label>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p className="footer-text">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
