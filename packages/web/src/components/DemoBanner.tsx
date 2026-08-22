import { Link } from 'react-router-dom';
import { C, F, alpha } from '../theme.js';

/**
 * Persistent banner shown at the top of the dashboard in demo mode.
 * Stays visible on all pages and links to the registration page.
 */
export function DemoBanner() {
  return (
    <div
      data-testid="demo-banner"
      style={{
        background: 'var(--demo-banner-bg)',
        borderBottom: '1px solid var(--demo-banner-border)',
        padding: '10px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        position: 'relative',
        zIndex: 100,
      }}
    >
      <span style={{
        color: C.accentText,
        fontSize: 13,
        fontFamily: F.body,
        fontWeight: 500,
      }}>
        You're viewing a demo
      </span>
      <span style={{
        color: alpha(C.text, 0.45),
        fontSize: 13,
      }}>
        |
      </span>
      <Link
        to="/register"
        style={{
          color: C.onAccent,
          fontSize: 13,
          fontFamily: F.body,
          fontWeight: 600,
          textDecoration: 'none',
          background: C.accent,
          padding: '5px 16px',
          borderRadius: 6,
        }}
      >
        Sign up to get started
      </Link>
    </div>
  );
}
