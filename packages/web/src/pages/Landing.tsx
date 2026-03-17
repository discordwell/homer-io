import { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { C, F } from '../theme.js';

const competitorPricing = [
  { id: 'tookan', name: 'Tookan', perDriver: 39 },
  { id: 'onfleet', name: 'Onfleet', perDriver: 65 },
  { id: 'optimoroute', name: 'OptimoRoute', perDriver: 44 },
  { id: 'circuit', name: 'Circuit', perDriver: 40 },
  { id: 'other', name: 'Other tool', perDriver: 45 },
];

const plans = [
  {
    id: 'free',
    name: 'Free',
    mo: 0,
    yr: 0,
    orders: '100',
    popular: false,
    feat: ['All core features', 'AI copilot (10/mo)', 'Email notifications'],
  },
  {
    id: 'standard',
    name: 'Standard',
    mo: 149,
    yr: 119,
    orders: '1,000',
    popular: false,
    feat: ['All core features', 'AI copilot (10/mo)', 'Email + SMS', 'E-commerce integrations'],
  },
  {
    id: 'growth',
    name: 'Growth',
    mo: 349,
    yr: 279,
    orders: '5,000',
    popular: true,
    feat: ['All core features', 'AI copilot (10/mo)', 'Email + SMS', 'E-commerce integrations', 'Priority support'],
  },
  {
    id: 'scale',
    name: 'Scale',
    mo: 699,
    yr: 559,
    orders: '15,000',
    popular: false,
    feat: ['All core features', 'AI copilot (10/mo)', 'Email + SMS', 'E-commerce integrations', 'Priority support', 'Custom branding'],
  },
];

const migrationNames = ['Tookan', 'Onfleet', 'OptimoRoute', 'SpeedyRoute', 'GetSwift', 'Circuit'];

const heroSignals = [
  { value: '19', label: 'fleet actions via AI', color: C.accent },
  { value: 'Live', label: 'dispatch state, not stale reports', color: C.green },
  { value: 'OSRM', label: 'route optimization core', color: C.orange },
  { value: '100', label: 'free orders to start', color: C.purple },
];

const actionPrompts = [
  {
    prompt: 'Which driver can absorb the late San Mateo stops?',
    outcome: 'Marcus can take 6 stops and still land before 4:20 PM.',
  },
  {
    prompt: 'Reassign RT-003 and warn the driver about traffic.',
    outcome: 'Priya gets the route. ETA shifts to 18 minutes and SMS is queued.',
  },
  {
    prompt: 'What is tomorrow going to look like in Redwood City?',
    outcome: 'Volume forecast is up 14% with a noon peak and one extra driver recommended.',
  },
];

const dispatchColumns = [
  {
    title: 'Queued',
    color: C.yellow,
    cards: [
      { id: 'RT-014', detail: '8 stops', meta: 'Redwood City', badge: 'Hold' },
      { id: 'RT-021', detail: '5 stops', meta: 'Foster City', badge: 'New' },
    ],
  },
  {
    title: 'Rolling',
    color: C.accent,
    cards: [
      { id: 'RT-003', detail: '12 stops', meta: 'Marcus · 19 min risk', badge: 'Watch' },
      { id: 'RT-009', detail: '9 stops', meta: 'Priya · ahead', badge: 'Clean' },
    ],
  },
  {
    title: 'Closed',
    color: C.green,
    cards: [
      { id: 'RT-001', detail: '15 stops', meta: 'Sofia · 98% on time', badge: 'Done' },
      { id: 'RT-006', detail: '11 stops', meta: 'Kai · 4 min avg stop', badge: 'Done' },
    ],
  },
];

const activityFeed = [
  { label: 'AI suggestion', detail: 'Junipero Serra reroute saves 19 min on RT-003', color: C.yellow },
  { label: 'Driver update', detail: 'Marcus finished stop 42 and is 4 min from the next cluster', color: C.accent },
  { label: 'Forecast', detail: 'Tomorrow volume climbs 14% in Redwood City from 10 AM to noon', color: C.purple },
];

const optimizationWins = [
  { value: '-22%', label: 'drive time', detail: 'Less zig-zagging between clusters.', color: C.accent },
  { value: '-18%', label: 'fuel cost', detail: 'Fewer unnecessary miles on each route.', color: C.green },
  { value: '94%', label: 'on-time', detail: 'Better sequencing keeps ETAs believable.', color: C.purple },
];

const optimizationRules = [
  'Respect driver capacity and route ownership.',
  'Pull urgent stops forward without trashing the rest of the day.',
  'Explain what changed and how much time it saves.',
  'Keep dispatchers in control before anything destructive happens.',
];

const migrationSteps = [
  {
    title: 'Connect or upload',
    detail: 'Use API credentials where supported or drop in CSVs when the platform is older.',
  },
  {
    title: 'Review the import',
    detail: 'Orders, drivers, and vehicles are previewed before anything lands in your account.',
  },
  {
    title: 'Go live fast',
    detail: 'Dispatch history stays readable and your team is running in minutes, not weeks.',
  },
];

const navLinks = [
  { label: 'Platform', href: '#platform' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Migrate', href: '#migrate' },
];

function bestPlan(drivers: number, annual: boolean) {
  if (drivers <= 10) return { id: 'standard', name: 'Standard', price: annual ? 119 : 149 };
  if (drivers <= 30) return { id: 'growth', name: 'Growth', price: annual ? 279 : 349 };
  return { id: 'scale', name: 'Scale', price: annual ? 559 : 699 };
}

function useScrolled(px = 24) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > px);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [px]);

  return scrolled;
}

function useWidth() {
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

const GlobalCSS = () => (
  <style>{`
html { scroll-behavior: smooth; }
html, body, #root { margin: 0; min-height: 100%; background: ${C.bg}; }
body {
  color: ${C.text};
  background:
    radial-gradient(circle at 12% -8%, rgba(91,164,245,0.24), transparent 28%),
    radial-gradient(circle at 88% 10%, rgba(167,139,250,0.14), transparent 22%),
    linear-gradient(180deg, #03080F 0%, #040A13 22%, #03080F 100%);
}
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(91,164,245,0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(91,164,245,0.05) 1px, transparent 1px);
  background-size: 84px 84px;
  mask-image: linear-gradient(180deg, rgba(255,255,255,0.36), transparent 76%);
}
body::after {
  content: "";
  position: fixed;
  inset: -25%;
  pointer-events: none;
  background:
    radial-gradient(circle at 50% 30%, rgba(91,164,245,0.08), transparent 34%),
    radial-gradient(circle at 50% 100%, rgba(167,139,250,0.06), transparent 30%);
  filter: blur(120px);
}
* { box-sizing: border-box; }
a { color: inherit; }
::selection { background: rgba(91,164,245,0.28); color: ${C.text}; }
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: ${C.bg2}; }
::-webkit-scrollbar-thumb { background: rgba(91,164,245,0.28); border-radius: 999px; }
@keyframes lFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
@keyframes lPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.38; } }
@keyframes lSweep { 0% { transform: translateX(-150%); } 100% { transform: translateX(250%); } }
.landing-shell { position: relative; overflow: clip; }
.landing-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(140deg, rgba(91,164,245,0.12), transparent 26%, transparent 74%, rgba(167,139,250,0.08));
  pointer-events: none;
}
.landing-panel::after {
  content: "";
  position: absolute;
  top: -1px;
  left: 8%;
  width: 34%;
  height: 1px;
  background: linear-gradient(90deg, rgba(255,255,255,0.32), transparent);
  pointer-events: none;
}
.landing-sheen {
  position: absolute;
  inset: auto auto 0 -12%;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, rgba(91,164,245,0.18), transparent 72%);
  pointer-events: none;
  filter: blur(6px);
}
.landing-line {
  position: absolute;
  left: -20%;
  top: 0;
  width: 90px;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  transform: skewX(-18deg);
  animation: lSweep 9s linear infinite;
  pointer-events: none;
}
.l-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: rgba(91,164,245,0.12);
  outline: none;
  cursor: pointer;
}
.l-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: ${C.accent};
  border: 2px solid rgba(255,255,255,0.76);
  box-shadow: 0 0 0 6px rgba(91,164,245,0.14);
}
.l-slider::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(255,255,255,0.76);
  background: ${C.accent};
  box-shadow: 0 0 0 6px rgba(91,164,245,0.14);
}
  `}</style>
);

const mx = (max = 1220): React.CSSProperties => ({
  maxWidth: max,
  margin: '0 auto',
  padding: '0 24px',
});

const btnAccent: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'linear-gradient(180deg, #68ABF5 0%, #4D93E6 100%)',
  color: '#fff',
  fontFamily: F.body,
  fontWeight: 700,
  fontSize: 15,
  padding: '14px 28px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 14px 34px rgba(91,164,245,0.26)',
  cursor: 'pointer',
  textDecoration: 'none',
};

const btnGhost: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  background: 'rgba(255,255,255,0.02)',
  color: C.text,
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 15,
  padding: '14px 24px',
  borderRadius: 12,
  border: '1px solid rgba(91,164,245,0.16)',
  cursor: 'pointer',
  textDecoration: 'none',
};

const eyebrowStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid rgba(91,164,245,0.18)',
  background: 'rgba(7,15,28,0.82)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: C.accent,
};

function Surface({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="landing-panel"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 28,
        border: '1px solid rgba(91,164,245,0.14)',
        background: 'linear-gradient(180deg, rgba(11,21,37,0.98) 0%, rgba(7,15,28,0.98) 100%)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      <div className="landing-sheen" />
      {children}
    </div>
  );
}

function SectionIntro({
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
    <div style={{ textAlign: align, maxWidth: align === 'center' ? 760 : 520 }}>
      <div style={eyebrowStyle}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, boxShadow: '0 0 18px rgba(91,164,245,0.5)' }} />
        {eyebrow}
      </div>
      <h2
        style={{
          margin: '18px 0 12px',
          fontFamily: F.display,
          fontWeight: 800,
          fontSize: align === 'center' ? 'clamp(36px, 5vw, 54px)' : 'clamp(34px, 4vw, 48px)',
          lineHeight: 0.98,
          letterSpacing: '-0.04em',
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          color: 'rgba(200,216,240,0.78)',
          fontSize: 17,
          lineHeight: 1.7,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function StatTile({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div
      style={{
        padding: '18px 18px 16px',
        borderRadius: 18,
        border: `1px solid ${color}22`,
        background: 'rgba(255,255,255,0.02)',
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 28, color, letterSpacing: '-0.04em' }}>{value}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(200,216,240,0.66)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  );
}

function SignalCard({
  title,
  detail,
  accent,
  style,
}: {
  title: string;
  detail: string;
  accent: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        maxWidth: 230,
        padding: '14px 16px',
        borderRadius: 18,
        border: `1px solid ${accent}33`,
        background: 'rgba(7,15,28,0.92)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 18px 42px rgba(0,0,0,0.32)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 14px ${accent}` }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: accent, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: C.text }}>{detail}</div>
    </div>
  );
}

function FleetMap() {
  return (
    <svg viewBox="0 0 620 420" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="fleetField" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#08111E" />
          <stop offset="55%" stopColor="#0A1628" />
          <stop offset="100%" stopColor="#07101C" />
        </linearGradient>
        <filter id="fleetGlow">
          <feGaussianBlur stdDeviation="5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="620" height="420" rx="24" fill="url(#fleetField)" />
      <rect x="1" y="1" width="618" height="418" rx="23" fill="none" stroke="rgba(91,164,245,0.12)" />

      {Array.from({ length: 8 }, (_, i) => (
        <line key={`h-${i}`} x1="0" y1={52 + i * 44} x2="620" y2={52 + i * 44} stroke="rgba(91,164,245,0.06)" strokeWidth="1" />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`v-${i}`} x1={44 + i * 58} y1="0" x2={44 + i * 58} y2="420" stroke="rgba(91,164,245,0.05)" strokeWidth="1" />
      ))}

      <rect x="32" y="44" width="116" height="74" rx="18" fill="rgba(91,164,245,0.08)" stroke="rgba(91,164,245,0.12)" />
      <rect x="438" y="56" width="136" height="82" rx="18" fill="rgba(167,139,250,0.07)" stroke="rgba(167,139,250,0.16)" />
      <rect x="386" y="258" width="164" height="102" rx="18" fill="rgba(52,211,153,0.06)" stroke="rgba(52,211,153,0.14)" />

      <path d="M78,328 C146,264 196,232 260,238 S386,274 470,214 S550,126 580,132" stroke={C.accent} strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#fleetGlow)" />
      <path d="M76,118 C146,186 196,242 248,298 S352,382 450,338 S520,258 570,252" stroke={C.green} strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#fleetGlow)" />
      <path d="M104,280 C160,236 214,180 280,154 S406,112 486,118" stroke={C.orange} strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#fleetGlow)" />
      <path d="M198,340 C244,326 290,330 328,314 S398,254 452,232" stroke={C.purple} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeDasharray="9 8" filter="url(#fleetGlow)" />

      {[
        { cx: 260, cy: 238, fill: C.accent },
        { cx: 470, cy: 214, fill: C.accent },
        { cx: 580, cy: 132, fill: C.accent },
        { cx: 248, cy: 298, fill: C.green },
        { cx: 450, cy: 338, fill: C.green },
        { cx: 280, cy: 154, fill: C.orange },
        { cx: 486, cy: 118, fill: C.orange },
        { cx: 452, cy: 232, fill: C.purple },
      ].map((dot, index) => (
        <circle
          key={index}
          cx={dot.cx}
          cy={dot.cy}
          r="6"
          fill={dot.fill}
          style={{ animation: `lPulse 2.4s ease-in-out ${index * 0.18}s infinite` }}
          filter="url(#fleetGlow)"
        />
      ))}

      <g transform="translate(24,18)">
        <rect width="212" height="70" rx="16" fill="rgba(7,15,28,0.88)" stroke="rgba(91,164,245,0.14)" />
        <text x="18" y="26" fill={C.accent} fontSize="11" fontFamily={F.mono} letterSpacing="1.4">LIVE FLEET MAP</text>
        <text x="18" y="50" fill={C.text} fontSize="18" fontFamily={F.display} fontWeight="700">12 drivers · 4 active routes</text>
      </g>

      <g transform="translate(426,300)">
        <rect width="168" height="82" rx="18" fill="rgba(7,15,28,0.9)" stroke="rgba(52,211,153,0.16)" />
        <text x="16" y="24" fill={C.green} fontSize="11" fontFamily={F.mono} letterSpacing="1.4">OPTIMIZATION</text>
        <text x="16" y="48" fill={C.text} fontSize="18" fontFamily={F.display} fontWeight="700">Save 19 min on RT-003</text>
        <text x="16" y="66" fill="rgba(200,216,240,0.7)" fontSize="11" fontFamily={F.body}>Junipero Serra beats El Camino right now.</text>
      </g>

      <text x="52" y="102" fill="rgba(200,216,240,0.56)" fontSize="10" fontFamily={F.mono}>Warehouse A</text>
      <text x="474" y="102" fill="rgba(200,216,240,0.56)" fontSize="10" fontFamily={F.mono}>North zone</text>
      <text x="446" y="278" fill="rgba(200,216,240,0.56)" fontSize="10" fontFamily={F.mono}>Low-risk cluster</text>
    </svg>
  );
}

function AIChatMockup({ compact = false }: { compact?: boolean }) {
  const pad = compact ? 18 : 22;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: pad,
        background: 'linear-gradient(180deg, rgba(9,18,31,0.98), rgba(8,14,24,0.98))',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 14, borderBottom: '1px solid rgba(91,164,245,0.1)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent, boxShadow: '0 0 16px rgba(91,164,245,0.55)' }} />
            <span style={{ fontWeight: 800, color: C.text, letterSpacing: '0.02em' }}>HOMER AI</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(200,216,240,0.62)' }}>Operations copilot with confirmation gates</div>
        </div>
        <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Live</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16, flex: 1 }}>
        <div style={{ alignSelf: 'flex-end', maxWidth: '88%', background: 'rgba(91,164,245,0.18)', border: '1px solid rgba(91,164,245,0.16)', borderRadius: '16px 16px 6px 16px', padding: '12px 14px', fontSize: 14, lineHeight: 1.5 }}>
          Which driver can absorb the late San Mateo stops and still land before 4:30?
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {['get_route_risk', 'find_drivers', 'estimate_eta'].map((tool) => (
            <span
              key={tool}
              style={{
                padding: '5px 8px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(91,164,245,0.12)',
                color: 'rgba(200,216,240,0.72)',
                fontFamily: F.mono,
                fontSize: 10,
              }}
            >
              {tool}
            </span>
          ))}
        </div>

        <div style={{ borderRadius: 18, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: '14px 14px 12px' }}>
          <div style={{ fontSize: 14, lineHeight: 1.7, color: C.text }}>
            Marcus is the cleanest option. He can take <span style={{ color: C.accent, fontWeight: 700 }}>6 stops</span> and still hit the last window by <span style={{ color: C.green, fontWeight: 700 }}>4:18 PM</span>.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
            {[
              { label: 'Slack', value: '+12 min', color: C.green },
              { label: 'Distance', value: '0.8 mi', color: C.accent },
              { label: 'Risk', value: 'Low', color: C.yellow },
            ].map((item) => (
              <div key={item.label} style={{ padding: '10px 10px 8px', borderRadius: 14, background: 'rgba(7,15,28,0.8)', border: '1px solid rgba(91,164,245,0.1)' }}>
                <div style={{ fontSize: 10, color: 'rgba(200,216,240,0.54)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                <div style={{ marginTop: 5, fontWeight: 700, color: item.color, fontSize: 14 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {!compact && (
          <>
            <div style={{ alignSelf: 'flex-end', maxWidth: '88%', background: 'rgba(91,164,245,0.18)', border: '1px solid rgba(91,164,245,0.16)', borderRadius: '16px 16px 6px 16px', padding: '12px 14px', fontSize: 14, lineHeight: 1.5 }}>
              Reassign RT-003 to Marcus and send him the traffic note.
            </div>

            <div style={{ borderRadius: 18, border: '1px solid rgba(52,211,153,0.18)', background: 'rgba(52,211,153,0.08)', padding: '14px 14px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(52,211,153,0.18)', color: C.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>✓</span>
                <span style={{ color: C.green, fontWeight: 700, fontSize: 13 }}>Confirmed action</span>
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text }}>
                Route reassigned. Driver SMS sent. Updated ETA is <span style={{ color: C.green, fontWeight: 700 }}>18 min</span>.
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(91,164,245,0.1)' }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(91,164,245,0.12)', color: 'rgba(200,216,240,0.58)', fontSize: 13 }}>
          Type a dispatch command or ask a question about the fleet...
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(180deg, #68ABF5 0%, #4D93E6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, boxShadow: '0 12px 28px rgba(91,164,245,0.26)' }}>
          ✦
        </div>
      </div>
    </div>
  );
}

function HeroControlRoom({ stacked }: { stacked: boolean }) {
  return (
    <div style={{ position: 'relative' }}>
      <Surface style={{ padding: stacked ? 18 : 20, animation: stacked ? undefined : 'lFloat 9s ease-in-out infinite' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 4px 16px' }}>
          <div>
            <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Mission Control</div>
            <div style={{ marginTop: 10, fontFamily: F.display, fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em' }}>Dispatch with signal, not guesswork.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(200,216,240,0.64)', fontSize: 13 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: C.green, boxShadow: '0 0 16px rgba(52,211,153,0.55)' }} />
            12 drivers live
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.22fr 0.92fr', gap: 16 }}>
          <div style={{ overflow: 'hidden', borderRadius: 22, border: '1px solid rgba(91,164,245,0.12)', minHeight: stacked ? 280 : 384 }}>
            <FleetMap />
          </div>

          <div style={{ display: 'grid', gridTemplateRows: stacked ? 'minmax(320px, auto) auto' : 'minmax(0, 1fr) auto', gap: 14 }}>
            <div style={{ overflow: 'hidden', borderRadius: 22, border: '1px solid rgba(91,164,245,0.12)', minHeight: stacked ? 320 : 384 }}>
              <AIChatMockup compact={stacked} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {[
                { label: 'On-time', value: '94%', color: C.green },
                { label: 'AI actions', value: '3', color: C.accent },
                { label: 'Forecast', value: '+14%', color: C.purple },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: 16, border: `1px solid ${item.color}22`, background: 'rgba(255,255,255,0.03)', padding: '14px 14px 12px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(200,216,240,0.54)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                  <div style={{ marginTop: 6, fontFamily: F.display, fontWeight: 800, fontSize: 24, color: item.color, letterSpacing: '-0.04em' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Surface>

      {!stacked && (
        <>
          <SignalCard
            title="AI suggestion"
            detail="Traffic spike on El Camino Real. A reroute is ready before the route actually slips."
            accent={C.yellow}
            style={{ top: 46, right: -22 }}
          />
          <SignalCard
            title="Tomorrow"
            detail="Redwood City looks heavy between 10 AM and noon. One extra driver is enough."
            accent={C.purple}
            style={{ left: -18, bottom: 54 }}
          />
        </>
      )}
    </div>
  );
}

function Nav({ compact }: { compact: boolean }) {
  const scrolled = useScrolled();
  const nav = useNavigate();

  return (
    <nav
      style={{
        position: 'fixed',
        inset: '0 0 auto 0',
        zIndex: 100,
        background: scrolled ? 'rgba(3,8,15,0.8)' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(91,164,245,0.12)' : '1px solid transparent',
        backdropFilter: scrolled ? 'blur(16px)' : undefined,
        transition: 'background .25s ease, border-color .25s ease',
      }}
    >
      <div style={{ ...mx(1220), display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, height: compact ? 68 : 78 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: F.display,
              fontWeight: 800,
              fontSize: compact ? 28 : 32,
              letterSpacing: '-0.04em',
              color: C.text,
            }}
          >
            HOMER<span style={{ color: C.accent }}>.io</span>
          </button>
          {!compact && (
            <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>AI dispatch OS</div>
          )}
        </div>

        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{
                  color: 'rgba(200,216,240,0.76)',
                  fontSize: 14,
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                {item.label}
              </a>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...btnGhost, padding: compact ? '12px 18px' : '12px 20px' }} onClick={() => nav('/login')}>Login</button>
          <button style={{ ...btnAccent, padding: compact ? '12px 18px' : '12px 22px' }} onClick={() => nav('/register')}>Start Free</button>
        </div>
      </div>
    </nav>
  );
}

function Hero({ w }: { w: number }) {
  const nav = useNavigate();
  const stacked = w < 980;

  return (
    <section style={{ position: 'relative', paddingTop: stacked ? 122 : 136, paddingBottom: stacked ? 72 : 96 }}>
      <div style={mx(1220)}>
        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 1.06fr) minmax(520px, 0.94fr)', gap: stacked ? 34 : 40, alignItems: 'start' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={eyebrowStyle}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
              Built for dispatchers, drivers, and operators
            </div>

            <h1
              style={{
                margin: '22px 0 18px',
                fontFamily: F.display,
                fontWeight: 800,
                fontSize: stacked ? 'clamp(52px, 14vw, 76px)' : 'clamp(60px, 6.2vw, 78px)',
                lineHeight: 0.92,
                letterSpacing: '-0.05em',
                maxWidth: 760,
              }}
            >
              A real control room for last-mile delivery.
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 560,
                fontSize: stacked ? 18 : 19,
                lineHeight: 1.72,
                color: 'rgba(200,216,240,0.78)',
              }}
            >
              Live fleet map, route optimization, driver tracking, and an AI copilot that can actually take action. HOMER should feel closer to a mission console than a generic SaaS brochure.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
              <button style={btnAccent} onClick={() => nav('/register')}>Start Free</button>
              <a href="https://homer.discordwell.com" target="_blank" rel="noopener noreferrer" style={btnGhost}>Explore Demo</a>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              {['Free forever', '100 orders/month', 'No credit card', 'Unlimited drivers on paid plans'].map((item) => (
                <span
                  key={item}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(91,164,245,0.14)',
                    background: 'rgba(255,255,255,0.02)',
                    color: 'rgba(200,216,240,0.7)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: stacked ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 28, maxWidth: 720 }}>
              {heroSignals.map((signal) => (
                <StatTile key={signal.label} value={signal.value} label={signal.label} color={signal.color} />
              ))}
            </div>
          </div>

          <HeroControlRoom stacked={stacked} />
        </div>
      </div>
    </section>
  );
}

function PlatformSection({ w }: { w: number }) {
  const stacked = w < 1040;

  return (
    <section id="platform" style={{ padding: '10px 0 36px' }}>
      <div style={mx(1220)}>
        <Surface style={{ padding: stacked ? 24 : 34 }}>
          <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '0.92fr 1.08fr', gap: stacked ? 28 : 34, alignItems: 'start' }}>
            <div>
              <SectionIntro
                eyebrow="Live visibility"
                title="See the work as a system, not a pile of tabs."
                body="The demo feels strong because every panel tells you something operationally real. The homepage should do the same: routes, drivers, exceptions, and AI suggestions living in one visual language."
              />

              <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
                {[
                  {
                    title: 'Dispatch board',
                    body: 'Routes move from queued to rolling to closed with real status, driver ownership, and risk context.',
                  },
                  {
                    title: 'Exception handling',
                    body: 'Traffic, late routes, and demand spikes show up as focused interrupts instead of generic alerts.',
                  },
                  {
                    title: 'One visual system',
                    body: 'The map, board, analytics, and AI panel all feel like the same product instead of stitched-together screens.',
                  },
                ].map((item) => (
                  <div key={item.title} style={{ padding: '16px 18px', borderRadius: 18, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.025)' }}>
                    <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em' }}>{item.title}</div>
                    <div style={{ marginTop: 6, fontSize: 15, lineHeight: 1.7, color: 'rgba(200,216,240,0.72)' }}>{item.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <Surface style={{ padding: 18, borderRadius: 24, background: 'linear-gradient(180deg, rgba(9,18,31,0.98) 0%, rgba(7,15,28,0.98) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottom: '1px solid rgba(91,164,245,0.1)' }}>
                <div>
                  <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Dispatch board</div>
                  <div style={{ marginTop: 10, fontFamily: F.display, fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em' }}>Everything in the same frame.</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 16, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(255,255,255,0.03)', textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'rgba(200,216,240,0.54)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</div>
                  <div style={{ marginTop: 4, color: C.green, fontWeight: 700, fontSize: 14 }}>94% on time</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: w < 820 ? '1fr' : '1.18fr 0.82fr', gap: 16, marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                  {dispatchColumns.map((column) => (
                    <div key={column.title} style={{ borderRadius: 18, border: `1px solid ${column.color}22`, background: 'rgba(255,255,255,0.03)', padding: 12 }}>
                      <div style={{ fontSize: 11, color: column.color, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>{column.title}</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {column.cards.map((card) => (
                          <div key={card.id} style={{ borderRadius: 14, border: '1px solid rgba(91,164,245,0.1)', background: 'rgba(7,15,28,0.78)', padding: '11px 11px 10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.text }}>{card.id}</div>
                              <span style={{ padding: '3px 6px', borderRadius: 999, background: `${column.color}14`, color: column.color, fontSize: 10, fontWeight: 700 }}>{card.badge}</span>
                            </div>
                            <div style={{ marginTop: 8, color: C.text, fontWeight: 600, fontSize: 13 }}>{card.detail}</div>
                            <div style={{ marginTop: 3, color: 'rgba(200,216,240,0.58)', fontSize: 11 }}>{card.meta}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {activityFeed.map((item) => (
                    <div key={item.detail} style={{ borderRadius: 18, border: `1px solid ${item.color}22`, background: 'rgba(255,255,255,0.03)', padding: '14px 14px 12px' }}>
                      <div style={{ fontSize: 10, color: item.color, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800 }}>{item.label}</div>
                      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.65, color: C.text }}>{item.detail}</div>
                    </div>
                  ))}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    {[
                      { label: 'Drivers live', value: '12' },
                      { label: 'Routes rolling', value: '4' },
                      { label: 'Alerts open', value: '3' },
                    ].map((item) => (
                      <div key={item.label} style={{ borderRadius: 16, border: '1px solid rgba(91,164,245,0.1)', background: 'rgba(7,15,28,0.78)', padding: '12px 12px 10px' }}>
                        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 24, letterSpacing: '-0.04em' }}>{item.value}</div>
                        <div style={{ marginTop: 2, fontSize: 10, color: 'rgba(200,216,240,0.56)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Surface>
          </div>
        </Surface>
      </div>
    </section>
  );
}

function RouteComparison() {
  const stops = [
    { x: 42, y: 38 },
    { x: 166, y: 24 },
    { x: 176, y: 146 },
    { x: 34, y: 168 },
    { x: 102, y: 98 },
    { x: 146, y: 178 },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 18, alignItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 10, fontSize: 11, color: C.red, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>Before</div>
        <svg viewBox="0 0 210 210" width="100%" style={{ maxWidth: 240 }}>
          <rect width="210" height="210" rx="22" fill="#08111E" stroke="rgba(248,113,113,0.16)" />
          <path d="M42,38 L176,146" stroke={C.red} strokeWidth="2" opacity="0.42" fill="none" />
          <path d="M166,24 L34,168" stroke={C.red} strokeWidth="2" opacity="0.42" fill="none" />
          <path d="M42,38 L146,178" stroke={C.red} strokeWidth="2" opacity="0.42" fill="none" />
          <path d="M166,24 L102,98 L34,168" stroke={C.red} strokeWidth="2" opacity="0.42" fill="none" />
          <path d="M176,146 L146,178" stroke={C.red} strokeWidth="2" opacity="0.42" fill="none" />
          <path d="M102,98 L176,146" stroke={C.red} strokeWidth="2" opacity="0.42" fill="none" />
          {stops.map((stop, index) => (
            <g key={index}>
              <circle cx={stop.x} cy={stop.y} r="7" fill="#0B1525" stroke={C.red} strokeWidth="2" />
              <text x={stop.x} y={stop.y + 4} textAnchor="middle" fill="rgba(200,216,240,0.62)" fontSize="8" fontFamily={F.mono}>{index + 1}</text>
            </g>
          ))}
        </svg>
      </div>

      <div style={{ fontFamily: F.display, fontSize: 40, color: C.accent, letterSpacing: '-0.04em' }}>→</div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 10, fontSize: 11, color: C.green, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>After</div>
        <svg viewBox="0 0 210 210" width="100%" style={{ maxWidth: 240 }}>
          <rect width="210" height="210" rx="22" fill="#08111E" stroke="rgba(52,211,153,0.16)" />
          <path d="M42,38 L166,24 L176,146 L146,178 L34,168 L102,98 L42,38" stroke={C.green} strokeWidth="3" fill="none" strokeLinejoin="round" />
          {stops.map((stop, index) => (
            <g key={index}>
              <circle cx={stop.x} cy={stop.y} r="7" fill="#0B1525" stroke={C.green} strokeWidth="2" />
              <text x={stop.x} y={stop.y + 4} textAnchor="middle" fill={C.text} fontSize="8" fontFamily={F.mono}>{index + 1}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function RoutingSection({ w }: { w: number }) {
  const stacked = w < 980;

  return (
    <section style={{ padding: '12px 0 36px' }}>
      <div style={mx(1220)}>
        <Surface style={{ padding: stacked ? 24 : 34 }}>
          <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.02fr 0.98fr', gap: stacked ? 28 : 34, alignItems: 'center' }}>
            <div>
              <SectionIntro
                eyebrow="Optimization"
                title="One click. Faster routes. Clear reasons."
                body="The demo has confidence because it shows intent. The homepage now does too: before and after, concrete time savings, and explicit rules about what the optimizer respects."
              />

              <div style={{ marginTop: 28, padding: '22px 20px', borderRadius: 24, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                <RouteComparison />
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                {optimizationWins.map((item) => (
                  <div key={item.label} style={{ borderRadius: 18, border: `1px solid ${item.color}22`, background: 'rgba(255,255,255,0.025)', padding: '16px 14px 14px' }}>
                    <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em', color: item.color }}>{item.value}</div>
                    <div style={{ marginTop: 4, color: C.text, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</div>
                    <div style={{ marginTop: 6, color: 'rgba(200,216,240,0.64)', fontSize: 12, lineHeight: 1.6 }}>{item.detail}</div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '20px 20px 18px', borderRadius: 22, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Why it feels better</div>
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  {optimizationRules.map((rule) => (
                    <div key={rule} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ marginTop: 5, width: 9, height: 9, borderRadius: '50%', background: C.accent, boxShadow: '0 0 14px rgba(91,164,245,0.45)' }} />
                      <span style={{ color: 'rgba(200,216,240,0.76)', fontSize: 15, lineHeight: 1.6 }}>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}

function CopilotSection({ w }: { w: number }) {
  const stacked = w < 1060;

  return (
    <section style={{ padding: '12px 0 36px' }}>
      <div style={mx(1220)}>
        <Surface style={{ padding: stacked ? 24 : 34 }}>
          <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '0.88fr 1.12fr', gap: stacked ? 28 : 34, alignItems: 'start' }}>
            <div>
              <SectionIntro
                eyebrow="Natural language ops"
                title="Ask the fleet a question. Or tell it what to do."
                body="The homepage needed more product truth. So this section now looks and reads like the actual system: concrete prompts, visible tool calls, and explicit confirmation before changes land."
              />

              <div style={{ display: 'grid', gap: 12, marginTop: 24 }}>
                {actionPrompts.map((item) => (
                  <div key={item.prompt} style={{ padding: '16px 18px', borderRadius: 18, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.025)' }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 15, lineHeight: 1.55 }}>{item.prompt}</div>
                    <div style={{ marginTop: 6, color: 'rgba(200,216,240,0.68)', fontSize: 14, lineHeight: 1.65 }}>{item.outcome}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateRows: 'auto auto', gap: 14 }}>
              <div style={{ overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(91,164,245,0.12)' }}>
                <AIChatMockup />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: w < 760 ? '1fr' : 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                {['Find risk', 'Compare drivers', 'Reassign work', 'Notify team'].map((item, index) => (
                  <div key={item} style={{ padding: '14px 12px 12px', borderRadius: 16, border: '1px solid rgba(91,164,245,0.1)', background: 'rgba(255,255,255,0.025)' }}>
                    <div style={{ color: [C.accent, C.green, C.yellow, C.purple][index], fontFamily: F.mono, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Step {index + 1}</div>
                    <div style={{ marginTop: 7, fontSize: 13, color: C.text, fontWeight: 700 }}>{item}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}

function PricingSection({ w }: { w: number }) {
  const nav = useNavigate();
  const [drivers, setDrivers] = useState(15);
  const [compIdx, setCompIdx] = useState(0);
  const [annual, setAnnual] = useState(false);
  const stacked = w < 980;

  const comp = competitorPricing[compIdx];
  const currentCost = drivers * comp.perDriver;
  const recommendation = bestPlan(drivers, annual);
  const savings = currentCost - recommendation.price;
  const recommendedPlan = plans.find((plan) => plan.id === recommendation.id) ?? plans[1];

  return (
    <section id="pricing" style={{ padding: '12px 0 36px' }}>
      <div style={mx(1220)}>
        <div style={{ marginBottom: 26 }}>
          <SectionIntro
            eyebrow="Pricing"
            title="Pay for deliveries, not headcount."
            body="The visual problem on the old homepage was also a product-story problem. The pricing section now spells out the difference quickly: flat plans, unlimited drivers, and savings against the tools teams already know."
            align="center"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '0.92fr 1.08fr', gap: 18, alignItems: 'stretch' }}>
          <Surface style={{ padding: stacked ? 24 : 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div>
                <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Savings calculator</div>
                <div style={{ marginTop: 10, fontFamily: F.display, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em' }}>See the delta fast.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'rgba(200,216,240,0.56)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recommended</div>
                <div style={{ marginTop: 4, color: C.accent, fontWeight: 800, fontSize: 16 }}>{recommendation.name}</div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <span style={{ color: 'rgba(200,216,240,0.66)', fontSize: 14 }}>Drivers</span>
                <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 28, letterSpacing: '-0.04em' }}>{drivers}</span>
              </div>
              <input
                type="range"
                className="l-slider"
                min={5}
                max={50}
                value={drivers}
                aria-label="Number of drivers"
                onChange={(e) => setDrivers(+e.target.value)}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ color: 'rgba(200,216,240,0.66)', fontSize: 14, marginBottom: 8 }}>Current tool</div>
              <select
                value={compIdx}
                onChange={(e) => setCompIdx(+e.target.value)}
                aria-label="Current delivery tool"
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid rgba(91,164,245,0.12)',
                  background: 'rgba(255,255,255,0.03)',
                  color: C.text,
                  padding: '12px 14px',
                  fontFamily: F.body,
                  fontSize: 14,
                  outline: 'none',
                }}
              >
                {competitorPricing.map((item, index) => (
                  <option key={item.id} value={index}>{item.name} (~${item.perDriver}/driver/mo)</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <div style={{ borderRadius: 20, border: '1px solid rgba(248,113,113,0.16)', background: 'rgba(248,113,113,0.06)', padding: '16px 16px 14px' }}>
                <div style={{ fontSize: 10, color: C.red, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800 }}>{comp.name}</div>
                <div style={{ marginTop: 8, fontFamily: F.display, fontWeight: 800, fontSize: 38, color: C.text, letterSpacing: '-0.05em' }}>${currentCost.toLocaleString()}</div>
                <div style={{ color: 'rgba(200,216,240,0.62)', fontSize: 13 }}>/month at {drivers} drivers</div>
              </div>

              <div style={{ borderRadius: 20, border: '1px solid rgba(52,211,153,0.18)', background: 'rgba(52,211,153,0.07)', padding: '16px 16px 14px' }}>
                <div style={{ fontSize: 10, color: C.green, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800 }}>HOMER {recommendation.name}</div>
                <div style={{ marginTop: 8, fontFamily: F.display, fontWeight: 800, fontSize: 38, color: C.text, letterSpacing: '-0.05em' }}>${recommendation.price}</div>
                <div style={{ color: 'rgba(200,216,240,0.62)', fontSize: 13 }}>/month, unlimited drivers</div>
              </div>
            </div>

            {savings > 0 && (
              <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 18, border: '1px solid rgba(52,211,153,0.18)', background: 'rgba(52,211,153,0.08)' }}>
                <div style={{ color: C.green, fontWeight: 800, fontSize: 15 }}>Save ${savings.toLocaleString()}/month</div>
                <div style={{ marginTop: 4, color: 'rgba(200,216,240,0.68)', fontSize: 13 }}>That is the point: pay for order volume, not how many drivers you need on a busy day.</div>
              </div>
            )}
          </Surface>

          <Surface style={{ padding: stacked ? 24 : 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Plan fit</div>
                <div style={{ marginTop: 10, fontFamily: F.display, fontWeight: 800, fontSize: 32, letterSpacing: '-0.04em' }}>
                  {recommendedPlan.name} makes the most sense right now.
                </div>
              </div>

              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(91,164,245,0.12)', padding: 4 }}>
                {(['Monthly', 'Annual'] as const).map((label) => {
                  const active = label === 'Annual' ? annual : !annual;

                  return (
                    <button
                      key={label}
                      onClick={() => setAnnual(label === 'Annual')}
                      style={{
                        padding: '10px 14px',
                        border: 'none',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: active ? 'linear-gradient(180deg, #68ABF5 0%, #4D93E6 100%)' : 'transparent',
                        color: active ? '#fff' : 'rgba(200,216,240,0.7)',
                        fontWeight: 700,
                        fontFamily: F.body,
                        fontSize: 13,
                      }}
                    >
                      {label}{label === 'Annual' ? ' (-20%)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: w < 680 ? '1fr' : '1fr 1fr', gap: 14, marginTop: 20 }}>
              <div style={{ borderRadius: 22, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(255,255,255,0.03)', padding: '20px 18px 18px' }}>
                <div style={{ fontSize: 10, color: C.accent, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>Included</div>
                <div style={{ marginTop: 10, fontFamily: F.display, fontSize: 44, fontWeight: 800, letterSpacing: '-0.05em' }}>${annual ? recommendedPlan.yr : recommendedPlan.mo}</div>
                <div style={{ color: 'rgba(200,216,240,0.66)', fontSize: 14 }}>/month · {recommendedPlan.orders} orders/month</div>
                <div style={{ marginTop: 12, color: C.green, fontSize: 13, fontWeight: 700 }}>Unlimited drivers stay included.</div>
              </div>

              <div style={{ borderRadius: 22, border: '1px solid rgba(52,211,153,0.16)', background: 'rgba(52,211,153,0.07)', padding: '20px 18px 18px' }}>
                <div style={{ fontSize: 10, color: C.green, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>Why it lands</div>
                <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.7, color: 'rgba(200,216,240,0.76)' }}>
                  Better visual hierarchy helps here too: one strong recommendation, clear savings, and a faster explanation of why the pricing model is different.
                </div>
              </div>
            </div>

            <ul style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'grid', gap: 10 }}>
              {recommendedPlan.feat.concat('Unlimited drivers').map((feature) => (
                <li key={feature} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(91,164,245,0.1)' }}>
                  <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
                  <span style={{ fontSize: 14, lineHeight: 1.55, color: C.text }}>{feature}</span>
                </li>
              ))}
            </ul>
          </Surface>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: w < 740 ? '1fr' : w < 1120 ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 14, marginTop: 18 }}>
          {plans.map((plan) => (
            <Surface
              key={plan.id}
              style={{
                padding: 24,
                borderRadius: 24,
                border: plan.popular ? '1px solid rgba(91,164,245,0.28)' : '1px solid rgba(91,164,245,0.12)',
                boxShadow: plan.popular ? '0 22px 70px rgba(91,164,245,0.16)' : '0 20px 50px rgba(0,0,0,0.28)',
              }}
            >
              {plan.popular && (
                <div style={{ position: 'absolute', top: 18, right: 18, padding: '6px 10px', borderRadius: 999, background: 'rgba(91,164,245,0.16)', color: C.accent, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Popular
                </div>
              )}

              <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em' }}>{plan.name}</div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 46, letterSpacing: '-0.05em' }}>${annual ? plan.yr : plan.mo}</span>
                <span style={{ color: 'rgba(200,216,240,0.6)', fontSize: 14 }}>/month</span>
              </div>
              <div style={{ marginTop: 4, color: C.accent, fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{plan.orders} orders/month</div>
              <div style={{ marginTop: 10, color: C.green, fontSize: 13, fontWeight: 700 }}>Unlimited drivers</div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 22px', display: 'grid', gap: 9 }}>
                {plan.feat.map((feature) => (
                  <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: 'rgba(200,216,240,0.72)', fontSize: 13, lineHeight: 1.55 }}>
                    <span style={{ color: C.green, fontWeight: 800 }}>✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button style={{ ...btnAccent, width: '100%' }} onClick={() => nav('/register')}>
                {plan.id === 'free' ? 'Start Free' : 'Get Started'}
              </button>
            </Surface>
          ))}
        </div>

        <p style={{ margin: '18px 0 0', textAlign: 'center', color: 'rgba(200,216,240,0.66)', fontSize: 14 }}>
          Need something bigger? <a href="mailto:hello@homer.io" style={{ color: C.accent, textDecoration: 'none', fontWeight: 700 }}>Talk to us.</a>
        </p>
      </div>
    </section>
  );
}

function MigrationSection({ w }: { w: number }) {
  const stacked = w < 980;

  return (
    <section id="migrate" style={{ padding: '12px 0 36px' }}>
      <div style={mx(1220)}>
        <Surface style={{ padding: stacked ? 24 : 34 }}>
          <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '0.9fr 1.1fr', gap: stacked ? 26 : 34, alignItems: 'start' }}>
            <div>
              <SectionIntro
                eyebrow="Migration"
                title="Switch without the replatforming drama."
                body="Another reason the demo felt better: it looked like a system you could move into now. The migration section now supports that feeling with a concrete path instead of hand-wavy logos."
              />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 24 }}>
                {migrationNames.map((name) => (
                  <span key={name} style={{ padding: '9px 14px', borderRadius: 999, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(255,255,255,0.03)', fontSize: 13, color: 'rgba(200,216,240,0.74)', fontWeight: 600 }}>
                    {name}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: 18, color: 'rgba(200,216,240,0.72)', fontSize: 15, lineHeight: 1.7 }}>
                API where the platform supports it. CSV when it does not. Orders, drivers, and vehicles preview before anything lands.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {migrationSteps.map((step, index) => (
                <div key={step.title} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, padding: '16px 18px', borderRadius: 20, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(91,164,245,0.16)', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.display, fontWeight: 800 }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 24, letterSpacing: '-0.03em' }}>{step.title}</div>
                    <div style={{ marginTop: 6, color: 'rgba(200,216,240,0.7)', fontSize: 14, lineHeight: 1.65 }}>{step.detail}</div>
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

function FinalCTA({ compact }: { compact: boolean }) {
  const nav = useNavigate();

  return (
    <section style={{ padding: '12px 0 62px' }}>
      <div style={mx(1080)}>
        <Surface style={{ padding: compact ? 28 : 42, textAlign: 'center' }}>
          <div className="landing-line" />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ ...eyebrowStyle, margin: '0 auto', justifyContent: 'center' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
              Start dispatching today
            </div>

            <h2 style={{ margin: '20px auto 14px', maxWidth: 760, fontFamily: F.display, fontWeight: 800, fontSize: compact ? 'clamp(40px, 10vw, 58px)' : 'clamp(48px, 6vw, 68px)', lineHeight: 0.94, letterSpacing: '-0.05em' }}>
              The homepage now matches the product energy behind it.
            </h2>

            <p style={{ margin: '0 auto', maxWidth: 720, color: 'rgba(200,216,240,0.74)', fontSize: 18, lineHeight: 1.7 }}>
              Route optimization, live dispatch, driver tracking, migration tooling, and an AI copilot that looks and feels like it belongs in the same product.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 26 }}>
              <button style={btnAccent} onClick={() => nav('/register')}>Start Free</button>
              <a href="https://homer.discordwell.com" target="_blank" rel="noopener noreferrer" style={btnGhost}>Explore Demo</a>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
              {['Route builder', 'Dispatch board', 'Driver PWA', 'AI copilot', 'Migration wizard'].map((item) => (
                <span key={item} style={{ padding: '9px 13px', borderRadius: 999, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(255,255,255,0.03)', fontSize: 12, color: 'rgba(200,216,240,0.72)', fontWeight: 600 }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </Surface>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ padding: '0 0 34px' }}>
      <div style={{ ...mx(1220), borderTop: '1px solid rgba(91,164,245,0.12)', paddingTop: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em' }}>
            HOMER<span style={{ color: C.accent }}>.io</span>
          </div>
          <div style={{ marginTop: 4, color: 'rgba(200,216,240,0.56)', fontSize: 12 }}>AI-powered logistics intelligence</div>
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', color: 'rgba(200,216,240,0.68)', fontSize: 14 }}>
          <Link to="/login" style={{ textDecoration: 'none' }}>Login</Link>
          <Link to="/register" style={{ textDecoration: 'none' }}>Register</Link>
          <a href="https://homer.discordwell.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Demo</a>
        </div>

        <div style={{ color: 'rgba(200,216,240,0.5)', fontSize: 12 }}>© 2026 HOMER.io</div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const width = useWidth();
  const compact = width < 820;

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <GlobalCSS />
      <div className="landing-shell">
        <Nav compact={compact} />
        <Hero w={width} />
        <PlatformSection w={width} />
        <RoutingSection w={width} />
        <CopilotSection w={width} />
        <PricingSection w={width} />
        <MigrationSection w={width} />
        <FinalCTA compact={compact} />
        <Footer />
      </div>
    </>
  );
}
