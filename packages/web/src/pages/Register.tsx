import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import { GoogleSignInButton } from '../components/GoogleSignInButton.js';
import type { AuthResponse, GoogleAuthResponse } from '@homer-io/shared';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
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
        <p className="subtitle">Create your account</p>

        {error && <div className="error-box">{error}</div>}

        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={setError}
          text="signup_with"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
          <span style={{ color: '#888', fontSize: 13 }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
        </div>

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
