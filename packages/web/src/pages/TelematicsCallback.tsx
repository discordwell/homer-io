import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTelematicsStore, type TelematicsProvider } from '../stores/telematics.js';
import { LoadingSpinner } from '../components/LoadingSpinner.js';
import { C, F } from '../theme.js';

export function TelematicsCallback() {
  const { completeConnect } = useTelematicsStore();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get('code');
    const stateParam = params.get('state');
    const storedState = sessionStorage.getItem('telematicsState');
    const provider = sessionStorage.getItem('telematicsProvider') as TelematicsProvider | null;

    async function run() {
      if (!code || !stateParam || !provider) {
        setError('Missing code / state / provider — please restart the connect flow from Settings → Integrations.');
        return;
      }
      if (storedState && storedState !== stateParam) {
        setError('State mismatch. Please restart the connect flow from Settings → Integrations.');
        return;
      }
      try {
        await completeConnect(provider, {
          state: stateParam,
          code,
          redirectUri: `${window.location.origin}/settings/telematics/callback`,
        });
        sessionStorage.removeItem('telematicsState');
        sessionStorage.removeItem('telematicsProvider');
        navigate('/dashboard/settings?tab=integrations&connected=' + provider, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connect failed');
      }
    }

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: F.body, color: C.text,
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: 24 }}>
        {!error ? (
          <>
            <LoadingSpinner />
            <p style={{ marginTop: 16, color: C.dim }}>Completing your telematics connection…</p>
          </>
        ) : (
          <>
            <h2 style={{ fontFamily: F.display, color: C.red, marginBottom: 12 }}>Connection failed</h2>
            <p style={{ color: C.dim, marginBottom: 24 }}>{error}</p>
            <button
              onClick={() => navigate('/dashboard/settings?tab=integrations')}
              style={{
                padding: '10px 20px', borderRadius: 8, background: C.accent,
                border: 'none', color: '#000', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Back to settings
            </button>
          </>
        )}
      </div>
    </div>
  );
}
