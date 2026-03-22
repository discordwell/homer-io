import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboardingStore } from '../stores/onboarding.js';
import { useAuthStore } from '../stores/auth.js';
import { C, F, alpha } from '../theme.js';

const INDUSTRY_SUBTITLES: Record<string, string> = {
  cannabis: "Let's set up your compliant delivery operation",
  florist: "Let's get your flower deliveries running beautifully",
  pharmacy: "Let's set up HIPAA-compliant prescription delivery",
  restaurant: "Let's get your delivery operation running fast",
  grocery: "Let's set up your grocery delivery system",
  furniture: "Let's configure your white-glove delivery service",
};

const STEP_LINKS: Record<string, string> = {
  vehicle: '/dashboard/fleet/vehicles',
  driver: '/dashboard/fleet/drivers',
  order: '/dashboard/orders',
  route: '/dashboard/routes/new',
  notification: '/dashboard/settings',
};

const INDUSTRY_OPTIONS = [
  { value: 'courier', label: 'Courier & Parcels', icon: '\u{1F4E6}', desc: 'Packages, documents, envelopes' },
  { value: 'restaurant', label: 'Restaurant', icon: '\u{1F37D}\uFE0F', desc: 'Food delivery, catering' },
  { value: 'florist', label: 'Florist', icon: '\u{1F490}', desc: 'Bouquets, arrangements, gifts' },
  { value: 'pharmacy', label: 'Pharmacy', icon: '\u{1F48A}', desc: 'Prescriptions, medical supplies' },
  { value: 'cannabis', label: 'Cannabis', icon: '\u{1F33F}', desc: 'Compliant cannabis delivery' },
  { value: 'grocery', label: 'Grocery', icon: '\u{1F6D2}', desc: 'Produce, staples, frozen goods' },
  { value: 'furniture', label: 'Furniture', icon: '\u{1F6CB}\uFE0F', desc: 'Large items, white-glove service' },
  { value: 'other', label: 'Other', icon: '\u{1F4CB}', desc: 'General delivery operations' },
] as const;

function IndustryPicker({ onSelect, loading: isLoading }: { onSelect: (v: string) => void; loading: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 8, opacity: isLoading ? 0.6 : 1, pointerEvents: isLoading ? 'none' : 'auto',
    }}>
      {INDUSTRY_OPTIONS.map(opt => (
        <button
          key={opt.value}
          aria-label={`Select ${opt.label}`}
          onClick={() => onSelect(opt.value)}
          onMouseEnter={() => setHovered(opt.value)}
          onMouseLeave={() => setHovered(null)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 4, padding: '14px 8px', borderRadius: 10,
            background: hovered === opt.value ? alpha(C.accent, 0.1) : C.bg2,
            border: `1px solid ${hovered === opt.value ? C.accent : C.muted}`,
            cursor: 'pointer', transition: 'all 0.15s ease',
          }}
        >
          <span style={{ fontSize: 24, lineHeight: 1 }}>{opt.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, fontFamily: F.body, color: C.text }}>{opt.label}</span>
          <span style={{ fontSize: 11, color: C.dim, fontFamily: F.body, textAlign: 'center', lineHeight: 1.3 }}>{opt.desc}</span>
        </button>
      ))}
    </div>
  );
}

export function OnboardingWizard() {
  const { status, loading, industryLoading, sampleDataLoading, fetchStatus, completeOnboarding, skipOnboarding, skipStep, setIndustry, loadSampleData } = useOnboardingStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [sampleDataResult, setSampleDataResult] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchStatus(); }, []);

  if (loading || !status || status.completed) return null;

  const allDone = status.steps.every(s => s.completed);
  const progress = status.steps.filter(s => s.completed).length;
  const industryStep = status.steps.find(s => s.key === 'industry');
  const industrySet = industryStep?.completed && !industryStep?.skipped;
  const industry = user?.industry ?? null;
  const subtitle = industry && INDUSTRY_SUBTITLES[industry]
    ? INDUSTRY_SUBTITLES[industry]
    : 'Complete these steps to get started';

  const handleLoadSampleData = async () => {
    try {
      const result = await loadSampleData();
      setSampleDataResult(`Loaded ${result.ordersCreated} sample orders`);
      setTimeout(() => setSampleDataResult(null), 5000);
    } catch {
      setSampleDataResult('Failed to load sample data');
      setTimeout(() => setSampleDataResult(null), 5000);
    }
  };

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
            {allDone
              ? 'Your setup is complete.'
              : industrySet
                ? `${subtitle} (${progress}/${status.steps.length})`
                : `Complete these steps to get started (${progress}/${status.steps.length})`
            }
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

      {/* Load sample data — prominent CTA after industry is selected */}
      {industrySet && !sampleDataResult && (
        <button
          onClick={handleLoadSampleData}
          disabled={sampleDataLoading}
          style={{
            width: '100%', padding: '14px 20px', marginBottom: 16,
            borderRadius: 10, border: `1px solid ${C.accent}`,
            background: alpha(C.accent, 0.08),
            color: C.accent, cursor: sampleDataLoading ? 'wait' : 'pointer',
            fontFamily: F.body, fontSize: 14, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s ease',
            opacity: sampleDataLoading ? 0.7 : 1,
          }}
        >
          <span style={{ fontSize: 18 }}>{sampleDataLoading ? '\u23F3' : '\u{1F4E6}'}</span>
          {sampleDataLoading ? 'Loading sample data\u2026' : 'Load sample data \u2014 see HOMER in action'}
        </button>
      )}
      {sampleDataResult && (
        <div style={{
          width: '100%', padding: '12px 20px', marginBottom: 16,
          borderRadius: 10, background: alpha(C.green, 0.1),
          border: `1px solid ${C.green}`,
          color: C.green, fontFamily: F.body, fontSize: 13, fontWeight: 500,
          textAlign: 'center',
        }}>
          {sampleDataResult}
        </div>
      )}

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {status.steps.map((step) => (
          <div key={step.key}>
            <div style={{
              display: 'flex', alignItems: step.key === 'industry' && !step.completed ? 'flex-start' : 'center', gap: 12,
              padding: '10px 14px', borderRadius: step.skipReason && !step.completed ? '8px 8px 0 0' : 8,
              background: C.bg3,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step.completed ? (step.skipped ? C.yellow : C.green) : C.muted,
                color: step.completed ? '#000' : C.dim,
                fontSize: 12, fontWeight: 600, flexShrink: 0,
                marginTop: step.key === 'industry' && !step.completed ? 2 : 0,
              }}>
                {step.completed ? (step.skipped ? '\u2192' : '\u2713') : '\u00B7'}
              </span>
              <div style={{ flex: 1 }}>
                <span style={{
                  fontSize: 14,
                  color: step.completed ? C.dim : C.text,
                  textDecoration: step.completed && !step.skipped ? 'line-through' : 'none',
                }}>
                  {step.label}
                  {step.skipped && (
                    <span style={{ fontSize: 11, color: C.dim, marginLeft: 8, fontStyle: 'italic' }}>
                      (skipped)
                    </span>
                  )}
                </span>
                {/* Inline industry picker */}
                {step.key === 'industry' && !step.completed && (
                  <div style={{ marginTop: 12 }}>
                    <IndustryPicker onSelect={setIndustry} loading={industryLoading} />
                  </div>
                )}
              </div>
              {!step.completed && step.key !== 'industry' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {step.skippable && (
                    <button
                      onClick={() => skipStep(step.key)}
                      style={{
                        padding: '4px 12px', borderRadius: 6,
                        background: 'transparent', border: `1px solid ${C.muted}`,
                        color: C.dim, cursor: 'pointer', fontFamily: F.body,
                        fontSize: 12, fontWeight: 400,
                      }}
                    >
                      Configure later
                    </button>
                  )}
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
                </div>
              )}
            </div>
            {/* Show skip reason hint when the step is not completed and has a reason */}
            {step.skipReason && !step.completed && (
              <div style={{
                padding: '8px 14px', borderRadius: '0 0 8px 8px',
                background: C.bg3, borderTop: `1px solid ${C.muted}`,
                fontSize: 12, color: C.yellow, lineHeight: 1.4,
              }}>
                {step.skipReason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
