import { anchorPlans } from '../../content/landing.js';
import { C } from '../../theme.js';
import {
  LandingF,
  SectionIntro,
  Surface,
  containerStyle,
  getTone,
} from './shared.js';

export function PricingSnapshotSection({ width }: { width: number }) {
  const stacked = width < 1040;

  return (
    <section id="pricing" style={{ padding: '28px 0 36px' }}>
      <div style={containerStyle(1260)}>
        <Surface style={{ padding: stacked ? 22 : 30 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 0.78fr) minmax(540px, 1.22fr)',
              gap: stacked ? 24 : 22,
              alignItems: 'start',
            }}
          >
            <div>
              <SectionIntro
                eyebrow="Pricing snapshot"
                title="Pay for delivery volume, not driver count."
                body="Keep pricing simple and lower on the page."
              />
              <div style={{ marginTop: 18, color: 'rgba(200,216,240,0.74)', fontSize: 15, lineHeight: 1.65 }}>
                Free gets teams started. Paid plans include unlimited drivers so busy weeks do not distort the buying decision.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              {anchorPlans.map((plan) => {
                const tone = getTone(plan.tone);
                return (
                  <div
                    key={plan.id}
                    style={{
                      position: 'relative',
                      overflow: 'hidden',
                      borderRadius: 24,
                      border: plan.featured ? `1px solid ${getTone('accent').border}` : `1px solid ${tone.border}`,
                      background: `linear-gradient(180deg, ${plan.featured ? 'rgba(91,164,245,0.12)' : tone.bg} 0%, rgba(7,15,28,0.92) 100%)`,
                      padding: '20px 18px 18px',
                      boxShadow: plan.featured ? '0 24px 70px rgba(91,164,245,0.16)' : '0 18px 50px rgba(0,0,0,0.20)',
                    }}
                  >
                    {plan.featured && (
                      <div style={{ position: 'absolute', top: 14, right: 14, padding: '6px 10px', borderRadius: 999, background: 'rgba(91,164,245,0.16)', color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        Recommended
                      </div>
                    )}

                    <div style={{ color: tone.solid, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{plan.orders}</div>
                    <div style={{ marginTop: 10, fontFamily: LandingF.display, fontWeight: 800, fontSize: 30, letterSpacing: '-0.05em' }}>
                      {plan.name}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <span style={{ fontFamily: LandingF.display, fontWeight: 800, fontSize: 44, letterSpacing: '-0.05em' }}>{plan.price}</span>
                      <span style={{ color: 'rgba(200,216,240,0.58)', fontSize: 14 }}>/ month</span>
                    </div>
                    <div style={{ marginTop: 10, color: 'rgba(200,216,240,0.72)', fontSize: 14, lineHeight: 1.6 }}>{plan.detail}</div>

                    <div style={{ display: 'grid', gap: 9, marginTop: 16 }}>
                      {plan.points.map((point) => (
                        <div key={point} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', background: tone.solid }} />
                          <span style={{ color: C.text, fontSize: 14, lineHeight: 1.55 }}>{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}
