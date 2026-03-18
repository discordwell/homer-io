import { Link } from 'react-router-dom';
import { heroMetrics } from '../../content/landing.js';
import { C } from '../../theme.js';
import {
  LandingF,
  Surface,
  containerStyle,
  getTone,
  primaryActionStyle,
  secondaryActionStyle,
} from './shared.js';

const approvalStats = [
  { label: 'Stops moved', value: '6', tone: 'accent' as const },
  { label: 'Minutes recovered', value: '18', tone: 'green' as const },
  { label: 'ETA updates queued', value: '22', tone: 'yellow' as const },
];

const routeCards = [
  {
    label: 'Route at risk',
    route: 'RT-204',
    detail: 'Marcus · downtown cluster · slipping by 17 min',
    tone: 'orange' as const,
  },
  {
    label: 'Recommended cover',
    route: 'RT-118',
    detail: 'Priya can absorb 6 stops and stay inside the window',
    tone: 'accent' as const,
  },
  {
    label: 'Post-approval state',
    route: 'Recovered',
    detail: 'Route reassigned. Updated ETAs staged for customers.',
    tone: 'green' as const,
  },
];

const intelligenceNotes = [
  { label: 'Address watch', value: '45 River St', detail: 'Previous gate-access failures on evening stops.' },
  { label: 'Service time', value: '6.4 min avg', detail: 'Downtown multi-tenant stops trend longer than route average.' },
];

export function HeroSection({ width }: { width: number }) {
  const stacked = width < 1040;
  const compact = width < 760;
  const metricsGrid = (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))',
        gap: 12,
        marginTop: 28,
      }}
    >
      {heroMetrics.map((metric) => {
        const tone = getTone(metric.tone);
        return (
          <div
            key={metric.label}
            style={{
              padding: '16px 16px 14px',
              borderRadius: 20,
              border: `1px solid ${tone.border}`,
              background: `linear-gradient(180deg, ${tone.bg} 0%, rgba(7,15,28,0.82) 100%)`,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: tone.solid, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {metric.value}
            </div>
            <div style={{ marginTop: 9, fontFamily: LandingF.display, fontWeight: 700, fontSize: 24, letterSpacing: '-0.04em' }}>
              {metric.label}
            </div>
            <div style={{ marginTop: 5, color: 'rgba(200,216,240,0.64)', fontSize: 13, lineHeight: 1.55 }}>
              {metric.detail}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <section style={{ position: 'relative', padding: compact ? '56px 0 38px' : '74px 0 54px' }}>
      <div style={{ position: 'absolute', inset: '-2% auto auto -4%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,164,245,0.16), transparent 72%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
      <div style={{ ...containerStyle(1260), position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 0.82fr) minmax(560px, 1.18fr)',
            gap: stacked ? 30 : 28,
            alignItems: 'start',
          }}
        >
          <div style={{ paddingTop: stacked ? 0 : 16 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 14px',
                borderRadius: 999,
                border: '1px solid rgba(91,164,245,0.14)',
                background: 'rgba(91,164,245,0.08)',
                color: C.accent,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
              AI dispatch copilot for last-mile ops
            </div>

            <h1
              style={{
                margin: '22px 0 16px',
                fontFamily: LandingF.display,
                fontWeight: 800,
                fontSize: stacked ? 'clamp(48px, 12vw, 72px)' : 'clamp(56px, 6vw, 82px)',
                lineHeight: 0.92,
                letterSpacing: '-0.06em',
                maxWidth: 620,
              }}
            >
              Recover the route before customers feel the delay.
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 560,
                color: 'rgba(200,216,240,0.78)',
                fontSize: compact ? 17 : 19,
                lineHeight: 1.72,
              }}
            >
              HOMER pairs a live dispatch board with an AI copilot that spots risk, proposes the next move, asks for approval, and updates the route from the same operating surface.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
              <Link to="/register" style={primaryActionStyle}>Start Free</Link>
              <a
                href="https://homer.discordwell.com/demo/"
                target="_blank"
                rel="noopener noreferrer"
                style={secondaryActionStyle}
              >
                See Live Demo
              </a>
            </div>

            <div style={{ marginTop: 16, color: 'rgba(200,216,240,0.64)', fontSize: 13, lineHeight: 1.7 }}>
              Free plan includes 100 orders per month. Paid plans keep driver count out of the pricing model.
            </div>

            {!compact && metricsGrid}
          </div>

          <HeroConsole compact={compact} />
        </div>

        {compact && metricsGrid}
      </div>
    </section>
  );
}

function HeroConsole({ compact }: { compact: boolean }) {
  return (
    <Surface style={{ padding: compact ? 20 : 26 }}>
      <div className="landing-sweep" />
      <div className="landing-grid-accent" />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Copilot action in progress
            </div>
            <div style={{ marginTop: 10, fontFamily: LandingF.display, fontWeight: 800, fontSize: compact ? 30 : 36, letterSpacing: '-0.05em' }}>
              Approval-gated recovery, tied to the live operation.
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 16, border: '1px solid rgba(52,211,153,0.16)', background: 'rgba(52,211,153,0.08)' }}>
            <div style={{ fontSize: 10, color: C.green, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live state</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700 }}>12 routes rolling</div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr' : 'minmax(0, 0.88fr) minmax(320px, 0.92fr)',
            gap: 16,
            marginTop: 20,
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <ConsoleBubble
              role="dispatcher"
              title="Dispatcher prompt"
              tone="accent"
              content="Reassign the six downtown stops from Marcus to Priya, recover the route, and queue updated ETAs for affected customers."
            />
            <ConsoleBubble
              role="homer"
              title="HOMER response"
              tone="dim"
              content="Priya can absorb the work and recover 18 minutes without breaking her delivery window. I can stage the reassignment and queue 22 ETA updates."
            />

            <div style={{ borderRadius: 24, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(4,10,18,0.9)', padding: '18px 18px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ color: C.yellow, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Approval gate</div>
                  <div style={{ marginTop: 6, fontFamily: LandingF.display, fontWeight: 700, fontSize: 24, letterSpacing: '-0.04em' }}>
                    Confirm the route recovery.
                  </div>
                </div>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.yellow, boxShadow: '0 0 18px rgba(251,191,36,0.55)', animation: 'landingPulse 2s ease-in-out infinite' }} />
              </div>

              <div style={{ marginTop: 14, color: 'rgba(200,216,240,0.72)', fontSize: 14, lineHeight: 1.65 }}>
                Reassign 6 stops from RT-204 to RT-118, recover a late cluster, and queue customer updates before the route slips outside the window.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 16 }}>
                {approvalStats.map((item) => {
                  const tone = getTone(item.tone);
                  return (
                    <div key={item.label} style={{ borderRadius: 18, border: `1px solid ${tone.border}`, background: tone.bg, padding: '14px 12px 12px' }}>
                      <div style={{ color: tone.solid, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontFamily: LandingF.display, fontWeight: 800, fontSize: 30, letterSpacing: '-0.05em' }}>{item.value}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <div style={{ ...primaryActionStyle, minHeight: 42, padding: '0 16px', fontSize: 14 }}>Approve action</div>
                <div style={{ ...secondaryActionStyle, minHeight: 42, padding: '0 16px', fontSize: 14 }}>Adjust plan</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ borderRadius: 24, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(7,15,28,0.88)', padding: '16px 16px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Dispatch board effect</div>
                  <div style={{ marginTop: 5, fontFamily: LandingF.display, fontWeight: 700, fontSize: 24, letterSpacing: '-0.04em' }}>
                    The route state updates with the action.
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(200,216,240,0.62)' }}>Linked to chat</div>
              </div>

              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {routeCards.map((item) => {
                  const tone = getTone(item.tone);
                  return (
                    <div key={item.route} style={{ borderRadius: 18, border: `1px solid ${tone.border}`, background: `linear-gradient(180deg, ${tone.bg} 0%, rgba(11,21,37,0.78) 100%)`, padding: '14px 14px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontSize: 10, color: tone.solid, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
                        <div style={{ fontFamily: LandingF.body, fontWeight: 700, color: C.text }}>{item.route}</div>
                      </div>
                      <div style={{ marginTop: 8, color: 'rgba(200,216,240,0.72)', fontSize: 13, lineHeight: 1.6 }}>{item.detail}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              {intelligenceNotes.map((item) => (
                <div key={item.label} style={{ borderRadius: 18, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: '14px 14px 12px' }}>
                  <div style={{ color: C.green, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ marginTop: 8, fontFamily: LandingF.display, fontWeight: 700, fontSize: 22, letterSpacing: '-0.04em' }}>{item.value}</div>
                  <div style={{ marginTop: 6, color: 'rgba(200,216,240,0.66)', fontSize: 12, lineHeight: 1.55 }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function ConsoleBubble({
  role,
  title,
  content,
  tone,
}: {
  role: string;
  title: string;
  content: string;
  tone: 'accent' | 'dim';
}) {
  const toneMeta = tone === 'accent'
    ? { border: 'rgba(91,164,245,0.18)', background: 'rgba(91,164,245,0.12)', label: C.accent }
    : { border: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', label: 'rgba(200,216,240,0.64)' };

  return (
    <div
      style={{
        borderRadius: 22,
        border: `1px solid ${toneMeta.border}`,
        background: toneMeta.background,
        padding: '16px 16px 14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: toneMeta.label, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</div>
        <div style={{ color: 'rgba(200,216,240,0.52)', fontSize: 12 }}>{role}</div>
      </div>
      <div style={{ marginTop: 10, color: C.text, fontSize: 14, lineHeight: 1.65 }}>
        {content}
      </div>
    </div>
  );
}
