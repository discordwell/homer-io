import { capabilityCards } from '../../content/landing.js';
import { C } from '../../theme.js';
import { LandingF, SectionIntro, Surface, containerStyle, getTone } from './shared.js';

export function CapabilityGridSection() {
  return (
    <section style={{ padding: '24px 0 36px' }}>
      <div style={containerStyle(1260)}>
        <SectionIntro
          eyebrow="Capabilities"
          title="Everything the homepage promises is already in the product."
          body="The supporting sections should be short, specific, and tied to actual surfaces inside the app: dispatch, driver workflow, notifications, intelligence, and migration."
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14, marginTop: 26 }}>
          {capabilityCards.map((card) => {
            const tone = getTone(card.tone);
            return (
              <Surface key={card.title} style={{ padding: 20, minHeight: 250 }}>
                <div style={{ position: 'absolute', inset: 'auto auto -36px -16px', width: 110, height: 110, borderRadius: '50%', background: `radial-gradient(circle, ${tone.bg} 0%, transparent 74%)`, filter: 'blur(6px)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ color: tone.solid, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {card.title}
                  </div>
                  <div style={{ marginTop: 10, color: 'rgba(200,216,240,0.74)', fontSize: 14, lineHeight: 1.65 }}>
                    {card.body}
                  </div>
                  <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                    {card.points.map((point) => (
                      <div key={point} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', background: tone.solid }} />
                        <span style={{ color: C.text, fontFamily: LandingF.body, fontSize: 14, lineHeight: 1.55 }}>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Surface>
            );
          })}
        </div>
      </div>
    </section>
  );
}

