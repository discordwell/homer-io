import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDemoStore } from '../stores/demo.js';
import { C, F, alpha } from '../theme.js';

/**
 * Full-screen email gate overlay for demo sessions.
 * Matches the landing page dark theme. One field, one click.
 */
export function DemoEmailGate() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const provisionTenant = useDemoStore((s) => s.provisionTenant);
  const emailError = useDemoStore((s) => s.emailError);
  const setEmailError = useDemoStore((s) => s.setEmailError);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setEmailError(null);
    setSubmitting(true);

    try {
      const lat = searchParams.get('lat');
      const lng = searchParams.get('lng');
      await provisionTenant(
        email,
        lat ? parseFloat(lat) : undefined,
        lng ? parseFloat(lng) : undefined,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: C.bg,
      fontFamily: F.body,
    }}>
      <form onSubmit={handleSubmit} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
        padding: 40,
        maxWidth: 420,
        width: '100%',
      }}>
        {/* Logo */}
        <div style={{
          fontSize: 32,
          fontWeight: 800,
          fontFamily: F.display,
          color: C.text,
          letterSpacing: '-0.02em',
          marginBottom: 8,
        }}>
          HOMER<span style={{ color: C.accent }}>.</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
          <h1 style={{
            color: C.text,
            fontSize: 28,
            fontFamily: F.display,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            margin: 0,
          }}>
            Explore the live demo
          </h1>

          <p style={{
            color: C.dim,
            fontSize: 15,
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.5,
          }}>
            Enter your email to spin up a temporary HOMER workspace with real interactions.
          </p>
        </div>

        {/* Email input */}
        <input
          ref={inputRef}
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
          }}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 8,
            border: `1px solid ${emailError ? C.red : C.border}`,
            background: C.bg2,
            color: C.text,
            fontSize: 15,
            fontFamily: F.body,
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            if (!emailError) e.currentTarget.style.borderColor = C.accent;
          }}
          onBlur={(e) => {
            if (!emailError) e.currentTarget.style.borderColor = C.border;
          }}
        />

        {/* Error message */}
        {emailError && (
          <p style={{
            color: C.red,
            fontSize: 13,
            margin: '-12px 0 0',
            textAlign: 'center',
          }}>
            {emailError}
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!isValid || submitting}
          style={{
            width: '100%',
            padding: '12px 24px',
            borderRadius: 8,
            border: 'none',
            background: isValid && !submitting ? C.accent : alpha(C.accent, 0.3),
            color: '#000',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: F.body,
            cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, opacity 0.15s',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Starting demo\u2026' : 'Start Demo'}
        </button>

        <p style={{
          color: C.muted,
          fontSize: 12,
          margin: 0,
          textAlign: 'center',
        }}>
          No account needed. Your demo expires in 7 days.
        </p>
      </form>
    </div>
  );
}
