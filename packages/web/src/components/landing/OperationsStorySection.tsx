import { storyCards } from '../../content/landing.js';
import { C } from '../../theme.js';
import { LandingF, SectionIntro, Surface, containerStyle, getTone } from './shared.js';

const draftRoutes = [
  { route: 'North Loop', stops: '18 stops', driver: 'Priya', note: 'Urgent cluster first' },
  { route: 'Central Loop', stops: '14 stops', driver: 'Marcus', note: 'Balanced by capacity' },
  { route: 'East Loop', stops: '11 stops', driver: 'Sofia', note: 'Tightest ETA window covered' },
];

const boardColumns = [
  {
    title: 'Queued',
    tone: 'yellow' as const,
    cards: ['RT-122 · 9 stops · hold for release', 'RT-131 · 6 stops · customer notes added'],
  },
  {
    title: 'Rolling',
    tone: 'accent' as const,
    cards: ['RT-204 · watch delay · 17 min risk', 'RT-118 · recovered · new ETA staged'],
  },
  {
    title: 'Closed',
    tone: 'green' as const,
    cards: ['RT-091 · 98% on time', 'RT-094 · 4.6 min avg stop'],
  },
];

const recoverTimeline = [
  { label: 'Risk found', detail: 'Downtown cluster slipping outside the window', tone: 'orange' as const },
  { label: 'Action proposed', detail: 'Copilot recommends shifting 6 stops to Priya', tone: 'accent' as const },
  { label: 'Updates staged', detail: '22 ETA notifications queued before approval', tone: 'green' as const },
];

export function OperationsStorySection({ width }: { width: number }) {
  const compact = width < 760;

  return (
    <section style={{ padding: '32px 0 36px' }}>
      <div style={containerStyle(1260)}>
        <SectionIntro
          eyebrow="Run the day with HOMER"
          title="Plan it, dispatch it, recover it from the same place."
          body="The homepage should show the shape of the product in sequence: get work into routes, run the live board, then absorb exceptions with the copilot."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 26 }}>
          {storyCards.map((card) => (
            <Surface key={card.step} style={{ padding: compact ? 20 : 24 }}>
              <div style={{ position: 'absolute', inset: 'auto auto -40px -20px', width: 140, height: 140, borderRadius: '50%', background: `radial-gradient(circle, ${getTone(card.tone).bg} 0%, transparent 74%)`, filter: 'blur(6px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ color: getTone(card.tone).solid, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  {card.step}
                </div>
                <div style={{ marginTop: 10, fontFamily: LandingF.display, fontWeight: 700, fontSize: 30, letterSpacing: '-0.04em', lineHeight: 1.02 }}>
                  {card.title}
                </div>
                <div style={{ marginTop: 10, color: 'rgba(200,216,240,0.72)', fontSize: 14, lineHeight: 1.65 }}>
                  {card.body}
                </div>

                <div style={{ marginTop: 18 }}>
                  {card.step === 'Plan' && <PlanPreview />}
                  {card.step === 'Dispatch' && <DispatchPreview />}
                  {card.step === 'Recover' && <RecoverPreview />}
                </div>

                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  {card.points.map((point) => (
                    <div key={point} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', background: getTone(card.tone).solid }} />
                      <span style={{ color: C.text, fontSize: 14, lineHeight: 1.55 }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Surface>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanPreview() {
  return (
    <div style={{ borderRadius: 20, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Auto-dispatch preview</div>
          <div style={{ marginTop: 5, fontFamily: LandingF.display, fontWeight: 700, fontSize: 22, letterSpacing: '-0.04em' }}>Draft routes ready for review</div>
        </div>
        <div style={{ padding: '8px 10px', borderRadius: 14, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(91,164,245,0.08)', fontSize: 12, fontWeight: 700 }}>
          3 drafts
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {draftRoutes.map((route) => (
          <div key={route.route} style={{ borderRadius: 16, border: '1px solid rgba(91,164,245,0.10)', background: 'rgba(4,10,18,0.72)', padding: '12px 12px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontFamily: LandingF.display, fontWeight: 700, fontSize: 18, letterSpacing: '-0.03em' }}>{route.route}</div>
              <div style={{ color: C.green, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{route.stops}</div>
            </div>
            <div style={{ marginTop: 5, color: 'rgba(200,216,240,0.66)', fontSize: 13 }}>{route.driver}</div>
            <div style={{ marginTop: 7, color: C.text, fontSize: 13, lineHeight: 1.5 }}>{route.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DispatchPreview() {
  return (
    <div style={{ borderRadius: 20, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: 14 }}>
      <div style={{ color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live dispatch board</div>
      <div style={{ marginTop: 5, fontFamily: LandingF.display, fontWeight: 700, fontSize: 22, letterSpacing: '-0.04em' }}>Board state stays tied to route context</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
        {boardColumns.map((column) => {
          const tone = getTone(column.tone);
          return (
            <div key={column.title} style={{ borderRadius: 16, border: `1px solid ${tone.border}`, background: tone.bg, padding: '10px 10px 8px' }}>
              <div style={{ color: tone.solid, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{column.title}</div>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {column.cards.map((card) => (
                  <div key={card} style={{ borderRadius: 12, background: 'rgba(4,10,18,0.74)', padding: '10px 10px 8px', color: C.text, fontSize: 12, lineHeight: 1.5 }}>
                    {card}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecoverPreview() {
  return (
    <div style={{ borderRadius: 20, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ color: C.orange, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Exception recovery</div>
          <div style={{ marginTop: 5, fontFamily: LandingF.display, fontWeight: 700, fontSize: 22, letterSpacing: '-0.04em' }}>A visible chain from risk to action</div>
        </div>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: C.orange, boxShadow: '0 0 18px rgba(251,146,60,0.55)', animation: 'landingPulse 2s ease-in-out infinite' }} />
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {recoverTimeline.map((item) => {
          const tone = getTone(item.tone);
          return (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, alignItems: 'start', borderRadius: 16, border: `1px solid ${tone.border}`, background: tone.bg, padding: '12px 12px 10px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(4,10,18,0.78)', border: `1px solid ${tone.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: tone.solid, fontSize: 12, fontWeight: 800 }}>
                {item.label.charAt(0)}
              </div>
              <div>
                <div style={{ color: tone.solid, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
                <div style={{ marginTop: 6, color: C.text, fontSize: 13, lineHeight: 1.55 }}>{item.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

