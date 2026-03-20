import { Link } from 'react-router-dom';
import { C, F } from '../theme.js';

/**
 * Persistent banner shown at the top of the dashboard in demo mode.
 * Stays visible on all pages and links to the registration page.
 */
export function DemoBanner() {
  return (
    <div
      data-testid="demo-banner"
      style={{
        background: 'linear-gradient(90deg, #1a3a5c 0%, #0f2b4a 100%)',
        borderBottom: '1px solid rgba(91, 164, 245, 0.3)',
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
        color: C.accent,
        fontSize: 13,
        fontFamily: F.body,
        fontWeight: 500,
      }}>
        You're viewing a demo
      </span>
      <span style={{
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
      }}>
        |
      </span>
      <Link
        to="/register"
        style={{
          color: '#fff',
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
