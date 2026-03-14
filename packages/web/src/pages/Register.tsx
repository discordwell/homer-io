import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import { C, F } from '../theme.js';
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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: C.bg,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: C.bg2, padding: 40, borderRadius: 16,
        border: `1px solid ${C.muted}`, width: 400, maxWidth: '90vw',
      }}>
        <h1 style={{ fontFamily: F.display, fontSize: 28, marginBottom: 8, color: C.accent }}>
          HOMER.io
        </h1>
        <p style={{ color: C.dim, marginBottom: 32 }}>Create your account</p>

        {error && <div style={{
          background: 'rgba(248,113,113,0.1)', border: `1px solid ${C.red}`,
          color: C.red, padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14,
        }}>{error}</div>}

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Your Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            required autoFocus style={inputStyle} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Organization Name</span>
          <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
            required style={inputStyle} />
        </label>

        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            required style={inputStyle} />
        </label>

        <label style={{ display: 'block', marginBottom: 24 }}>
          <span style={{ color: C.dim, fontSize: 13, display: 'block', marginBottom: 6 }}>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            required minLength={8} style={inputStyle} />
        </label>

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: 14, borderRadius: 10,
          background: C.accent, color: '#fff', border: 'none',
          fontSize: 15, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          fontFamily: F.body, opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', marginTop: 20, color: C.dim, fontSize: 14 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: C.accent, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </form>
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
