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
          body="Keep the rest of the page short and specific."
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
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                    {card.points.map((point) => (
                      <span key={point} style={{ padding: '7px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(91,164,245,0.10)', color: C.text, fontFamily: LandingF.body, fontSize: 12, fontWeight: 600 }}>
                        {point}
                      </span>
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
