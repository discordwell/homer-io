import { Link } from 'react-router-dom';
import { landingNavLinks } from '../../content/landing.js';
import { C } from '../../theme.js';
import {
  LandingF,
  containerStyle,
  primaryActionStyle,
  secondaryActionStyle,
} from './shared.js';

export function LandingNav({
  compact,
  scrolled,
}: {
  compact: boolean;
  scrolled: boolean;
}) {
  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        backdropFilter: scrolled ? 'blur(18px)' : 'blur(10px)',
        background: scrolled ? 'rgba(3,8,15,0.88)' : 'rgba(3,8,15,0.48)',
        borderBottom: scrolled ? '1px solid rgba(91,164,245,0.10)' : '1px solid transparent',
      }}
    >
      <div
        style={{
          ...containerStyle(1260),
          padding: compact ? '0 16px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          minHeight: compact ? 74 : 84,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 14 }}>
          <Link
            to="/"
            style={{
              textDecoration: 'none',
              fontFamily: LandingF.brand,
              fontWeight: 800,
              fontSize: compact ? 24 : 38,
              letterSpacing: '-0.05em',
              lineHeight: 1,
            }}
          >
            HOMER<span style={{ color: C.accent }}>.io</span>
          </Link>

          {!compact && (
            <div
              style={{
                padding: '8px 12px',
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
              AI dispatch copilot
            </div>
          )}
        </div>

        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 22, color: 'rgba(200,216,240,0.74)' }}>
            {landingNavLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  textDecoration: 'none',
                  fontFamily: LandingF.body,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12 }}>
          <Link
            to="/login"
            style={{
              ...secondaryActionStyle,
              minHeight: compact ? 40 : 48,
              padding: compact ? '0 12px' : '0 18px',
              fontSize: compact ? 13 : 15,
            }}
          >
            Login
          </Link>
          <Link
            to="/register"
            style={{
              ...primaryActionStyle,
              minHeight: compact ? 40 : 48,
              padding: compact ? '0 12px' : '0 20px',
              fontSize: compact ? 13 : 15,
            }}
          >
            Start Free
          </Link>
        </div>
      </div>
    </nav>
  );
}
