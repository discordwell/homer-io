import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../stores/onboarding.js';
import { C, F } from '../theme.js';

const STEP_LINKS: Record<string, string> = {
  vehicle: '/dashboard/fleet/vehicles',
  driver: '/dashboard/fleet/drivers',
  order: '/dashboard/orders',
  route: '/dashboard/routes/new',
  notification: '/dashboard/settings',
};

export function OnboardingWizard() {
  const { status, loading, fetchStatus, completeOnboarding, skipOnboarding } = useOnboardingStore();
  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStatus(); }, []);

  if (loading || !status || status.completed) return null;

  const allDone = status.steps.every(s => s.completed);
  const progress = status.steps.filter(s => s.completed).length;

  return (
    <div style={{
      background: C.bg2, borderRadius: 12, border: `1px solid ${C.muted}`,
      padding: 24, margin: '0 0 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontFamily: F.display, fontSize: 18, marginBottom: 4 }}>
            {allDone ? 'All set! You\'re ready to go' : 'Welcome to HOMER.io'}
          </h3>
          <p style={{ color: C.dim, fontSize: 13 }}>
            {allDone ? 'Your setup is complete.' : `Complete these steps to get started (${progress}/${status.steps.length})`}
          </p>
        </div>
        <button
          onClick={allDone ? completeOnboarding : skipOnboarding}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: allDone ? C.accent : 'transparent',
            border: allDone ? 'none' : `1px solid ${C.muted}`,
            color: allDone ? '#fff' : C.dim,
            cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: allDone ? 600 : 400,
          }}
        >
          {allDone ? 'Finish' : 'Skip setup'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ background: C.bg3, borderRadius: 4, height: 6, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          width: `${(progress / status.steps.length) * 100}%`,
          height: '100%', background: C.accent, borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {status.steps.map((step) => (
          <div key={step.key} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 8, background: C.bg3,
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step.completed ? C.green : C.muted,
              color: step.completed ? '#000' : C.dim,
              fontSize: 12, fontWeight: 600, flexShrink: 0,
            }}>
              {step.completed ? '\u2713' : '\u00B7'}
            </span>
            <span style={{
              flex: 1, fontSize: 14,
              color: step.completed ? C.dim : C.text,
              textDecoration: step.completed ? 'line-through' : 'none',
            }}>
              {step.label}
            </span>
            {!step.completed && (
              <button
                onClick={() => navigate(STEP_LINKS[step.key] || '/dashboard')}
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  background: C.accent, border: 'none', color: '#000',
                  cursor: 'pointer', fontFamily: F.body, fontSize: 12, fontWeight: 600,
                }}
              >
                Go
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
