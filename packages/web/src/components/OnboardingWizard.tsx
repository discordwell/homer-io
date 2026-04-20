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
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))',
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

function useIsCompact(breakpoint = 720) {
  const [isCompact, setIsCompact] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = (event: MediaQueryListEvent) => setIsCompact(event.matches);
    setIsCompact(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isCompact;
}

function getStepHint(stepKey: string) {
  switch (stepKey) {
    case 'industry':
      return 'Choose the operating mode that matches your delivery business.';
    case 'vehicle':
      return 'Add the vehicles dispatch will plan around.';
    case 'driver':
      return 'Invite the drivers who will actually run these stops.';
    case 'order':
      return 'Bring in real demand before creating the first route.';
    case 'route':
      return 'Turn today’s orders into a dispatchable route.';
    case 'notification':
      return 'Decide how customers hear from you when drivers move.';
    default:
      return '';
  }
}

export function OnboardingWizard() {
  const { status, loading, industryLoading, sampleDataLoading, fetchStatus, completeOnboarding, skipOnboarding, skipStep, setIndustry, loadSampleData } = useOnboardingStore();
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [sampleDataResult, setSampleDataResult] = useState<string | null>(null);
  const isCompact = useIsCompact();
  const isCompressed = useIsCompact(1080);

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
  const progressLabel = allDone
    ? 'Setup complete'
    : `${progress} of ${status.steps.length} steps complete`;
  const title = allDone ? 'You are ready to dispatch' : 'Setup roadmap';
  const detail = allDone
    ? 'Your workspace has the basics in place. You can start dispatching real work now.'
    : (industrySet ? subtitle : 'Choose your industry and finish the remaining setup steps.');

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
      background: `linear-gradient(180deg, ${alpha(C.surface, 0.94)} 0%, ${alpha(C.bg3, 0.98)} 100%)`,
      borderRadius: 16,
      border: `1px solid ${alpha(C.muted, 0.35)}`,
      boxShadow: '0 18px 42px rgba(0, 0, 0, 0.24)',
      padding: isCompact ? 18 : 22,
      margin: '0 0 20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: isCompact ? 'flex-start' : 'center',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 14,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: C.accent,
            marginBottom: 8,
          }}>
            {progressLabel}
          </div>
          <h3 style={{ fontFamily: F.display, fontSize: 20, marginBottom: 6 }}>
            {title}
          </h3>
          <p style={{ color: C.dim, fontSize: 13, lineHeight: 1.6, maxWidth: 580 }}>
            {detail}
          </p>
        </div>
        <button
          onClick={allDone ? completeOnboarding : skipOnboarding}
          style={{
            padding: '8px 16px', borderRadius: 999,
            background: allDone ? C.accent : 'transparent',
            border: allDone ? 'none' : `1px solid ${alpha(C.muted, 0.55)}`,
            color: allDone ? '#000' : C.dim,
            cursor: 'pointer', fontFamily: F.body, fontSize: 13, fontWeight: allDone ? 700 : 500,
          }}
        >
          {allDone ? 'Finish' : 'Skip setup'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ background: alpha(C.muted, 0.12), borderRadius: 999, height: 6, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          width: `${(progress / status.steps.length) * 100}%`,
          height: '100%', background: C.accent, borderRadius: 999,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Load sample data — prominent CTA after industry is selected */}
      {industrySet && !sampleDataResult && (
        <div style={{
          display: 'flex',
          flexDirection: isCompact ? 'column' : 'row',
          alignItems: isCompact ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: isCompact ? '14px 16px' : '16px 18px',
          marginBottom: 16,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${alpha(C.accent, 0.1)} 0%, ${alpha(C.green, 0.06)} 100%)`,
          border: `1px solid ${alpha(C.accent, 0.45)}`,
        }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 15, color: C.text, marginBottom: 4 }}>
              Load a realistic workspace
            </div>
            <div style={{ color: C.dim, fontSize: 12.5, lineHeight: 1.5, maxWidth: 520 }}>
              Seed orders, routes, and fleet data so the dashboard feels alive before your real dispatch volume shows up.
            </div>
          </div>
          <button
            onClick={handleLoadSampleData}
            disabled={sampleDataLoading}
            style={{
              padding: '10px 16px',
              minHeight: 42,
              minWidth: isCompact ? '100%' : 0,
              borderRadius: 999,
              border: 'none',
              background: C.accent,
              color: '#000',
              cursor: sampleDataLoading ? 'wait' : 'pointer',
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 700,
              opacity: sampleDataLoading ? 0.7 : 1,
            }}
          >
            {sampleDataLoading ? 'Loading sample data\u2026' : 'Load sample data'}
          </button>
        </div>
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: isCompact ? '1fr' : (isCompressed ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))'),
        gap: 8,
        alignItems: 'start',
      }}>
        {status.steps.map((step, index) => {
          const actions = !step.completed && step.key !== 'industry' ? (
            <div style={{
              display: 'flex',
              gap: 8,
              flexDirection: isCompact ? 'column' : 'row',
              alignItems: 'stretch',
              justifyContent: 'flex-end',
              marginLeft: isCompact ? 36 : 0,
              width: isCompact ? 'calc(100% - 36px)' : 'auto',
            }}>
              <button
                onClick={() => navigate(STEP_LINKS[step.key] || '/dashboard')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 999,
                  background: C.accent,
                  border: 'none',
                  color: '#000',
                  cursor: 'pointer',
                  fontFamily: F.body,
                  fontSize: 12,
                  fontWeight: 700,
                  minHeight: 42,
                  whiteSpace: 'nowrap',
                }}
              >
                {isCompact ? `Open ${step.label.toLowerCase()}` : 'Open'}
              </button>
              {step.skippable && (
                <button
                  onClick={() => skipStep(step.key)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: `1px solid ${alpha(C.muted, 0.55)}`,
                    color: C.dim,
                    cursor: 'pointer',
                    fontFamily: F.body,
                    fontSize: 12,
                    fontWeight: 500,
                    minHeight: 42,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Configure later
                </button>
              )}
            </div>
          ) : null;

          return (
          <div key={step.key}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              height: '100%',
              padding: isCompact ? '14px 14px 12px' : '12px 14px',
              borderRadius: step.skipReason && !step.completed ? '12px 12px 0 0' : 12,
              background: step.completed ? alpha(C.green, 0.05) : alpha(C.bg3, 0.92),
              border: `1px solid ${step.completed ? alpha(C.green, 0.18) : alpha(C.muted, 0.22)}`,
            }}>
              <div style={{
                display: 'flex',
                alignItems: step.key === 'industry' && !step.completed ? 'flex-start' : 'center',
                gap: 12,
              }}>
                <span style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: step.completed ? (step.skipped ? C.yellow : C.green) : alpha(C.muted, 0.35),
                  color: step.completed ? '#000' : C.dim,
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: step.key === 'industry' && !step.completed ? 2 : 0,
                }}>
                  {step.completed ? (step.skipped ? '\u2192' : '\u2713') : index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: step.completed ? C.dim : C.text,
                    textDecoration: step.completed && !step.skipped ? 'line-through' : 'none',
                  }}>
                    {step.label}
                    {step.skipped && (
                      <span style={{ fontSize: 11, color: C.dim, marginLeft: 8, fontStyle: 'italic', fontWeight: 400 }}>
                        (skipped)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>
                    {step.completed
                      ? (step.skipped ? 'Marked for later. You can revisit it whenever the rest of the workspace is stable.' : 'Done.')
                      : getStepHint(step.key)}
                  </div>
                  {step.key === 'industry' && !step.completed && (
                    <div style={{ marginTop: 14 }}>
                      <IndustryPicker onSelect={setIndustry} loading={industryLoading} />
                    </div>
                  )}
                </div>
                {!isCompact && actions}
              </div>
              {isCompact && actions}
            </div>
            {/* Show skip reason hint when the step is not completed and has a reason */}
            {step.skipReason && !step.completed && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '0 0 12px 12px',
                background: alpha(C.bg3, 0.94),
                borderTop: `1px solid ${alpha(C.muted, 0.2)}`,
                fontSize: 12, color: C.yellow, lineHeight: 1.4,
              }}>
                {step.skipReason}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
