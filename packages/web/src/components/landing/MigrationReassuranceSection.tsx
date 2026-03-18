import { migrationPlatforms, migrationSteps } from '../../content/landing.js';
import { C } from '../../theme.js';
import { LandingF, SectionIntro, Surface, containerStyle } from './shared.js';

export function MigrationReassuranceSection({ width }: { width: number }) {
  const stacked = width < 980;

  return (
    <section id="migration" style={{ padding: '20px 0 42px' }}>
      <div style={containerStyle(1260)}>
        <Surface style={{ padding: stacked ? 22 : 28 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 0.82fr) minmax(420px, 1.18fr)',
              gap: stacked ? 22 : 26,
              alignItems: 'start',
            }}
          >
            <div>
              <SectionIntro
                eyebrow="Migration reassurance"
                title="Switch without turning migration into the whole story."
                body="Migration matters, but it should show up as confidence-building support near the end of the page. Keep the promise simple: connect, review, and move fast."
              />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                {migrationPlatforms.map((platform) => (
                  <span key={platform} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,216,240,0.74)', fontSize: 13, fontWeight: 600 }}>
                    {platform}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {migrationSteps.map((step, index) => (
                <div key={step.title} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'start', borderRadius: 20, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: '16px 16px 14px' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(91,164,245,0.14)', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: LandingF.display, fontWeight: 800 }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontFamily: LandingF.display, fontWeight: 700, fontSize: 24, letterSpacing: '-0.03em' }}>{step.title}</div>
                    <div style={{ marginTop: 6, color: 'rgba(200,216,240,0.70)', fontSize: 14, lineHeight: 1.65 }}>{step.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}

