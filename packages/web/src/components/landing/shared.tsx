/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from 'react';
import { C, F as ThemeFonts } from '../../theme.js';

export const LandingF = {
  ...ThemeFonts,
  display: "'Manrope', 'Segoe UI', sans-serif",
  body: "'Manrope', 'Segoe UI', sans-serif",
  brand: ThemeFonts.display,
} as const;

export type LandingTone = 'accent' | 'green' | 'yellow' | 'orange' | 'purple' | 'red' | 'dim';

const toneMap: Record<LandingTone, { solid: string; border: string; bg: string }> = {
  accent: { solid: C.accent, border: 'rgba(91,164,245,0.18)', bg: 'rgba(91,164,245,0.10)' },
  green: { solid: C.green, border: 'rgba(52,211,153,0.20)', bg: 'rgba(52,211,153,0.10)' },
  yellow: { solid: C.yellow, border: 'rgba(251,191,36,0.22)', bg: 'rgba(251,191,36,0.10)' },
  orange: { solid: C.orange, border: 'rgba(251,146,60,0.22)', bg: 'rgba(251,146,60,0.10)' },
  purple: { solid: C.purple, border: 'rgba(167,139,250,0.20)', bg: 'rgba(167,139,250,0.10)' },
  red: { solid: C.red, border: 'rgba(248,113,113,0.22)', bg: 'rgba(248,113,113,0.10)' },
  dim: { solid: C.dim, border: 'rgba(104,136,170,0.20)', bg: 'rgba(104,136,170,0.08)' },
};

export function getTone(tone: LandingTone) {
  return toneMap[tone];
}

export function useLandingWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setWidth(window.innerWidth), 80);
    };

    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return width;
}

export function useScrolled(px = 24) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > px);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [px]);

  return scrolled;
}

export function LandingGlobalStyles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
html {
  scroll-behavior: smooth;
  background: ${C.bg};
  color-scheme: dark;
}
html, body, #root {
  margin: 0;
  min-height: 100%;
  width: 100%;
  background: ${C.bg};
  overflow-x: hidden;
}
body {
  color: ${C.text};
  overflow-x: hidden;
  background:
    radial-gradient(circle at 14% -6%, rgba(91,164,245,0.26), transparent 28%),
    radial-gradient(circle at 86% 12%, rgba(52,211,153,0.10), transparent 18%),
    radial-gradient(circle at 78% 18%, rgba(251,146,60,0.10), transparent 22%),
    linear-gradient(180deg, #03080F 0%, #050B13 24%, #03080F 100%);
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(91,164,245,0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91,164,245,0.04) 1px, transparent 1px);
  background-size: 84px 84px;
  mask-image: linear-gradient(180deg, rgba(255,255,255,0.34), transparent 78%);
}
body::after {
  content: "";
  position: fixed;
  inset: -24%;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 24%, rgba(91,164,245,0.08), transparent 34%),
    radial-gradient(circle at 50% 100%, rgba(52,211,153,0.06), transparent 28%);
  filter: blur(120px);
}
* { box-sizing: border-box; }
a { color: inherit; }
button, input, select, textarea { font: inherit; }
::selection { background: rgba(91,164,245,0.28); color: ${C.text}; }
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: ${C.bg2}; }
::-webkit-scrollbar-thumb { background: rgba(91,164,245,0.28); border-radius: 999px; }
@keyframes landingFloat {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}
@keyframes landingPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.42; }
}
@keyframes landingSweep {
  0% { transform: translateX(-150%); }
  100% { transform: translateX(250%); }
}
.landing-shell {
  position: relative;
  overflow: hidden;
}
.landing-grid-accent {
  position: absolute;
  inset: auto auto 0 -12%;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(91,164,245,0.18), transparent 72%);
  pointer-events: none;
  filter: blur(6px);
}
.landing-sweep {
  position: absolute;
  left: -20%;
  top: 0;
  width: 100px;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  transform: skewX(-18deg);
  animation: landingSweep 9s linear infinite;
  pointer-events: none;
}
    `}</style>
  );
}

export const primaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 50,
  padding: '0 20px',
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'linear-gradient(180deg, #6AB2FF 0%, #4D93E6 100%)',
  color: '#FFFFFF',
  textDecoration: 'none',
  fontFamily: LandingF.body,
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: '-0.01em',
  boxShadow: '0 20px 40px rgba(91,164,245,0.22)',
};

export const secondaryActionStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 50,
  padding: '0 20px',
  borderRadius: 16,
  border: '1px solid rgba(91,164,245,0.16)',
  background: 'rgba(7,15,28,0.84)',
  color: C.text,
  textDecoration: 'none',
  fontFamily: LandingF.body,
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: '-0.01em',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
};

export function containerStyle(max = 1220): React.CSSProperties {
  return {
    maxWidth: max,
    margin: '0 auto',
    padding: '0 24px',
  };
}

export function Surface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 28,
        border: '1px solid rgba(91,164,245,0.12)',
        background: 'linear-gradient(180deg, rgba(10,19,34,0.98) 0%, rgba(6,12,22,0.96) 100%)',
        boxShadow: '0 26px 80px rgba(0,0,0,0.28)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionIntro({
  eyebrow,
  title,
  body,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  body: string;
  align?: 'left' | 'center';
}) {
  return (
    <div
      style={{
        maxWidth: align === 'center' ? 760 : 620,
        margin: align === 'center' ? '0 auto' : undefined,
        textAlign: align,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 999,
          border: '1px solid rgba(91,164,245,0.12)',
          background: 'rgba(91,164,245,0.08)',
          color: C.accent,
          fontFamily: LandingF.body,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
        {eyebrow}
      </div>

      <h2
        style={{
          margin: '18px 0 10px',
          fontFamily: LandingF.display,
          fontWeight: 800,
          fontSize: 'clamp(32px, 4vw, 52px)',
          lineHeight: 0.98,
          letterSpacing: '-0.05em',
        }}
      >
        {title}
      </h2>

      <p
        style={{
          margin: 0,
          color: 'rgba(200,216,240,0.76)',
          fontSize: 17,
          lineHeight: 1.7,
        }}
      >
        {body}
      </p>
    </div>
  );
}
