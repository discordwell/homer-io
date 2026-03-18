import { Link } from 'react-router-dom';
import { finalProofPills } from '../../content/landing.js';
import { C } from '../../theme.js';
import {
  LandingF,
  Surface,
  containerStyle,
  primaryActionStyle,
  secondaryActionStyle,
} from './shared.js';

export function LandingFooter({ compact }: { compact: boolean }) {
  return (
    <>
      <section style={{ padding: '8px 0 56px' }}>
        <div style={containerStyle(1100)}>
          <Surface style={{ padding: compact ? 28 : 40, textAlign: 'center' }}>
            <div className="landing-sweep" />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(91,164,245,0.08)', color: C.accent, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
                Ready to run the day differently
              </div>

              <h2 style={{ margin: '18px auto 14px', maxWidth: 760, fontFamily: LandingF.display, fontWeight: 800, fontSize: compact ? 'clamp(40px, 10vw, 54px)' : 'clamp(48px, 6vw, 66px)', lineHeight: 0.94, letterSpacing: '-0.05em' }}>
                Put the dispatch board, AI copilot, and recovery flow on the same screen.
              </h2>

              <p style={{ margin: '0 auto', maxWidth: 700, color: 'rgba(200,216,240,0.74)', fontSize: 17, lineHeight: 1.7 }}>
                Start on the free plan or walk through the live demo first.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 26 }}>
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

              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                {finalProofPills.map((item) => (
                  <span key={item} style={{ padding: '9px 13px', borderRadius: 999, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,216,240,0.72)', fontSize: 12, fontWeight: 600 }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </Surface>
        </div>
      </section>

      <footer style={{ padding: '0 0 34px' }}>
        <div style={{ ...containerStyle(1260), borderTop: '1px solid rgba(91,164,245,0.12)', paddingTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: LandingF.brand, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em' }}>
              HOMER<span style={{ color: C.accent }}>.io</span>
            </div>
            <div style={{ marginTop: 4, color: 'rgba(200,216,240,0.54)', fontSize: 12 }}>
              AI-powered dispatch for courier and delivery teams
            </div>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: 'rgba(200,216,240,0.68)', fontSize: 14 }}>
            <Link to="/login" style={{ textDecoration: 'none' }}>Login</Link>
            <Link to="/register" style={{ textDecoration: 'none' }}>Register</Link>
            <a href="https://homer.discordwell.com/demo/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Demo</a>
          </div>

          <div style={{ color: 'rgba(200,216,240,0.48)', fontSize: 12 }}>© 2026 HOMER.io</div>
        </div>
      </footer>
    </>
  );
}
