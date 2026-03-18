import { proofCards } from '../../content/landing.js';
import { C } from '../../theme.js';
import { LandingF, containerStyle, getTone } from './shared.js';

export function ProofStripSection() {
  return (
    <section id="product" style={{ padding: '12px 0 28px' }}>
      <div style={containerStyle(1260)}>
        <div style={{ marginBottom: 20, maxWidth: 720 }}>
          <div style={{ color: C.accent, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
            What dispatch sees next
          </div>
          <div style={{ marginTop: 10, fontFamily: LandingF.display, fontWeight: 800, fontSize: 'clamp(28px, 3.6vw, 42px)', letterSpacing: '-0.05em', lineHeight: 1 }}>
            The copilot is attached to a real operating system, not a chat demo.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {proofCards.map((card) => {
            const tone = getTone(card.tone);
            return (
              <div
                key={card.title}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 24,
                  border: `1px solid ${tone.border}`,
                  background: `linear-gradient(180deg, ${tone.bg} 0%, rgba(8,15,27,0.92) 100%)`,
                  padding: '20px 20px 18px',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
                }}
              >
                <div style={{ color: tone.solid, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {card.eyebrow}
                </div>
                <div style={{ marginTop: 12, fontFamily: LandingF.display, fontWeight: 700, fontSize: 28, letterSpacing: '-0.04em', lineHeight: 1.02 }}>
                  {card.title}
                </div>
                <div style={{ marginTop: 10, color: 'rgba(200,216,240,0.72)', fontSize: 14, lineHeight: 1.68 }}>
                  {card.body}
                </div>

                <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                  {card.points.map((point) => (
                    <div key={point} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <span style={{ width: 8, height: 8, marginTop: 6, borderRadius: '50%', background: tone.solid, boxShadow: `0 0 14px ${tone.bg}` }} />
                      <span style={{ color: C.text, fontSize: 14, lineHeight: 1.55 }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

