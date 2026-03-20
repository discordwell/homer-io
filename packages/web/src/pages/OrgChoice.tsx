import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { api } from '../api/client.js';
import type { GoogleAuthResponse } from '@homer-io/shared';

export function OrgChoicePage() {
  const pendingGoogleUser = useAuthStore((s) => s.pendingGoogleUser);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');
  const navigate = useNavigate();

  if (!pendingGoogleUser) {
    return <Navigate to="/login" replace />;
  }

  const joinOption = pendingGoogleUser.orgOptions.find(o => o.type === 'join');

  async function handleChoice(choice: 'join' | 'fresh' | 'demo') {
    setError('');
    setLoading(choice);

    if (choice === 'fresh' && !orgName.trim()) {
      setError('Please enter an organization name');
      setLoading('');
      return;
    }

    try {
      const res = await api.post<GoogleAuthResponse>('/auth/google/org-choice', {
        credential: pendingGoogleUser!.credential,
        choice,
        orgName: choice === 'demo' ? `${pendingGoogleUser!.name}'s Demo` : orgName || undefined,
      });
      if (res.auth) {
        setAuth(res.auth);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading('');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 480 }}>
        <h1>HOMER<span className="dot">.</span></h1>
        <p className="subtitle">Welcome, {pendingGoogleUser.name}!</p>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>
          How would you like to get started?
        </p>

        {error && <div className="error-box">{error}</div>}

        {joinOption && (
          <button
            type="button"
            onClick={() => handleChoice('join')}
            disabled={!!loading}
            className="btn-primary"
            style={{ marginBottom: 12 }}
          >
            {loading === 'join' ? 'Joining...' : `Join ${joinOption.tenantName}`}
          </button>
        )}

        <div style={{ marginBottom: 12 }}>
          <label>
            <span>Organization Name</span>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Bay Area Courier Co."
            />
          </label>
          <button
            type="button"
            onClick={() => handleChoice('fresh')}
            disabled={!!loading}
            className="btn-primary"
            style={{ marginTop: 8, background: '#333' }}
          >
            {loading === 'fresh' ? 'Creating...' : 'Start fresh'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
          <span style={{ color: '#888', fontSize: 13 }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid #e0e0e0' }} />
        </div>

        <button
          type="button"
          onClick={() => handleChoice('demo')}
          disabled={!!loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            border: '1px solid #dadce0',
            borderRadius: 8,
            background: '#f8f9fa',
            color: '#3c4043',
            fontSize: 14,
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading === 'demo' ? 'Setting up demo...' : 'Explore with demo data'}
        </button>
        <p style={{ color: '#888', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
          Get a pre-loaded Bay Area courier fleet to play with
        </p>
      </div>
    </div>
  );
}
