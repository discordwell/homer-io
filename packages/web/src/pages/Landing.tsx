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
  { value: '94%', label: 'on-time across active routes', detail: '4 rolling routes and 12 drivers live in the same view.', color: C.green },
  { value: '19m', label: 'reroute recovered before SLA breach', detail: 'Traffic on RT-003 is caught early and recovered with one action.', color: C.yellow },
  { value: '+14%', label: 'tomorrow demand spike forecast', detail: 'Redwood City noon volume is flagged before dispatch starts.', color: C.purple },
  { value: '2m', label: 'customer updates after route changes', detail: 'Notifications can go out as soon as the plan shifts.', color: C.accent },
];

const heroModules = ['Live fleet map', 'Dispatch board', 'Driver app', 'Tracking page', 'Webhooks', 'AI copilot'];

const heroWatchlist = [
  { route: 'RT-003', status: 'Traffic risk', detail: 'Junipero Serra recovers 19 min and preserves the last window.', color: C.yellow },
  { route: 'RT-014', status: 'Warehouse hold', detail: 'An 8-stop cluster is queued and ready to release when inventory clears.', color: C.orange },
  { route: 'RT-021', status: 'Forecast bump', detail: 'One spare driver covers the noon spike without blowing up the day.', color: C.purple },
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
  overscroll-behavior: none;
  background:
    radial-gradient(circle at 12% -8%, rgba(91,164,245,0.24), transparent 28%),
    radial-gradient(circle at 88% 10%, rgba(167,139,250,0.14), transparent 22%),
    radial-gradient(circle at 72% 24%, rgba(251,146,60,0.09), transparent 24%),
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
button, input, select, textarea { font: inherit; }
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
  detail,
  color,
}: {
  value: string;
  label: string;
  detail: string;
  color: string;
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '18px 18px 16px',
        borderRadius: 20,
        border: `1px solid ${color}22`,
        background: `linear-gradient(180deg, ${color}14 0%, rgba(255,255,255,0.035) 42%, rgba(255,255,255,0.02) 100%)`,
        minWidth: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 'auto -18% -58% 56%',
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}40 0%, transparent 72%)`,
          filter: 'blur(10px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: F.display, fontWeight: 800, fontSize: 30, color, letterSpacing: '-0.04em' }}>{value}</div>
        <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(200,216,240,0.72)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>{label}</div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: 'rgba(200,216,240,0.7)' }}>{detail}</div>
      </div>
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
          <stop offset="0%" stopColor="#07111F" />
          <stop offset="58%" stopColor="#0A1628" />
          <stop offset="100%" stopColor="#08111D" />
        </linearGradient>
        <linearGradient id="bayFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(8,18,34,0.92)" />
          <stop offset="100%" stopColor="rgba(5,11,22,0.72)" />
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

      <path
        d="M618 8 L618 412 L442 412 C432 364 432 318 452 282 C470 250 492 222 506 182 C520 142 520 92 500 32 Z"
        fill="url(#bayFill)"
        opacity="0.86"
      />

      {Array.from({ length: 8 }, (_, i) => (
        <line key={`h-${i}`} x1="0" y1={48 + i * 44} x2="620" y2={48 + i * 44} stroke="rgba(91,164,245,0.05)" strokeWidth="1" />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <line key={`v-${i}`} x1={36 + i * 56} y1="0" x2={36 + i * 56} y2="420" stroke="rgba(91,164,245,0.045)" strokeWidth="1" />
      ))}

      {[
        'M18 344 C102 296 168 250 236 188 S366 92 456 44',
        'M52 114 C136 166 208 224 290 264 S424 330 566 346',
        'M88 290 C160 244 218 200 286 152 S404 98 504 112',
        'M136 46 C194 92 246 132 308 158 S436 198 560 210',
        'M194 370 C256 338 324 324 384 292 S458 214 494 174',
      ].map((road, index) => (
        <path key={road} d={road} stroke="rgba(20,40,72,0.8)" strokeWidth={index === 0 ? 4 : 3} fill="none" strokeLinecap="round" />
      ))}

      {[
        { name: 'Redwood City', x: 196, y: 232 },
        { name: 'San Mateo', x: 308, y: 172 },
        { name: 'Burlingame', x: 366, y: 132 },
        { name: 'Daly City', x: 464, y: 86 },
        { name: 'Foster City', x: 352, y: 212 },
      ].map((city) => (
        <g key={city.name}>
          <circle cx={city.x} cy={city.y} r="4" fill="rgba(91,164,245,0.36)" />
          <text x={city.x + 10} y={city.y - 8} fill="rgba(200,216,240,0.44)" fontSize="10" fontFamily={F.mono}>
            {city.name}
          </text>
        </g>
      ))}

      <path d="M72,326 C142,266 194,230 266,232 S396,262 472,206 S544,138 580,138" stroke={C.accent} strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#fleetGlow)" />
      <path d="M74,112 C150,182 200,238 250,292 S348,370 444,332 S522,260 570,250" stroke={C.green} strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#fleetGlow)" />
      <path d="M108,276 C168,224 220,180 286,154 S404,110 490,118" stroke={C.orange} strokeWidth="3.5" fill="none" strokeLinecap="round" filter="url(#fleetGlow)" />
      <path d="M198,346 C240,334 286,334 326,314 S400,256 452,232" stroke={C.purple} strokeWidth="3.5" fill="none" strokeLinecap="round" strokeDasharray="9 8" filter="url(#fleetGlow)" />

      {[
        { cx: 266, cy: 232, fill: C.accent, label: 'RT-001' },
        { cx: 472, cy: 206, fill: C.accent, label: 'RT-001' },
        { cx: 580, cy: 138, fill: C.accent, label: 'RT-001' },
        { cx: 250, cy: 292, fill: C.green, label: 'RT-002' },
        { cx: 444, cy: 332, fill: C.green, label: 'RT-002' },
        { cx: 286, cy: 154, fill: C.orange, label: 'RT-014' },
        { cx: 490, cy: 118, fill: C.orange, label: 'RT-014' },
        { cx: 452, cy: 232, fill: C.purple, label: 'RT-021' },
      ].map((dot, index) => (
        <g key={`${dot.label}-${index}`}>
          <circle
            cx={dot.cx}
            cy={dot.cy}
            r="6"
            fill={dot.fill}
            style={{ animation: `lPulse 2.4s ease-in-out ${index * 0.18}s infinite` }}
            filter="url(#fleetGlow)"
          />
          <circle cx={dot.cx} cy={dot.cy} r="12" fill="none" stroke={`${dot.fill}40`} strokeWidth="1.5" />
        </g>
      ))}

      {[
        { x: 240, y: 230, fill: C.accent },
        { x: 334, y: 178, fill: C.green },
        { x: 458, y: 136, fill: C.yellow },
      ].map((driver, index) => (
        <path
          key={index}
          d={`M ${driver.x} ${driver.y - 12} L ${driver.x + 12} ${driver.y} L ${driver.x} ${driver.y + 12} L ${driver.x - 12} ${driver.y} Z`}
          fill={driver.fill}
          stroke={C.bg}
          strokeWidth="2"
          filter="url(#fleetGlow)"
        />
      ))}

      <g transform="translate(24,18)">
        <rect width="216" height="78" rx="18" fill="rgba(7,15,28,0.9)" stroke="rgba(91,164,245,0.14)" />
        <text x="18" y="28" fill={C.accent} fontSize="11" fontFamily={F.mono} letterSpacing="1.4">LIVE FLEET MAP</text>
        <text x="18" y="52" fill={C.text} fontSize="19" fontFamily={F.display} fontWeight="700">12 drivers · 4 active routes</text>
        <text x="18" y="68" fill="rgba(200,216,240,0.62)" fontSize="11" fontFamily={F.body}>Route state, driver location, and exception risk in one frame.</text>
      </g>

      <g transform="translate(422,20)">
        <rect width="172" height="84" rx="18" fill="rgba(7,15,28,0.9)" stroke="rgba(52,211,153,0.16)" />
        <text x="16" y="24" fill={C.green} fontSize="11" fontFamily={F.mono} letterSpacing="1.4">ROUTE HEALTH</text>
        <text x="16" y="52" fill={C.text} fontSize="28" fontFamily={F.display} fontWeight="700">94% on time</text>
        <text x="16" y="69" fill="rgba(200,216,240,0.64)" fontSize="11" fontFamily={F.body}>3 watched exceptions · 1 reroute ready</text>
      </g>

      <g transform="translate(24,306)">
        <rect width="248" height="90" rx="18" fill="rgba(7,15,28,0.9)" stroke="rgba(91,164,245,0.14)" />
        <text x="16" y="24" fill={C.accent} fontSize="11" fontFamily={F.mono} letterSpacing="1.4">ROLLING ROUTES</text>
        {[
          { id: 'RT-001', detail: 'Marcus · 14 stops left', color: C.accent, y: 46 },
          { id: 'RT-002', detail: 'Priya · ahead of plan', color: C.green, y: 64 },
          { id: 'RT-003', detail: 'Traffic watch · reroute staged', color: C.yellow, y: 82 },
        ].map((item) => (
          <g key={item.id}>
            <rect x="16" y={item.y - 9} width="22" height="3" rx="2" fill={item.color} />
            <text x="48" y={item.y} fill={C.text} fontSize="12" fontFamily={F.mono}>{item.id}</text>
            <text x="96" y={item.y} fill="rgba(200,216,240,0.62)" fontSize="11" fontFamily={F.body}>{item.detail}</text>
          </g>
        ))}
      </g>

      <g transform="translate(390,294)">
        <rect width="204" height="102" rx="18" fill="rgba(7,15,28,0.9)" stroke="rgba(167,139,250,0.18)" />
        <text x="16" y="24" fill={C.purple} fontSize="11" fontFamily={F.mono} letterSpacing="1.4">FORECAST</text>
        <text x="16" y="48" fill={C.text} fontSize="18" fontFamily={F.display} fontWeight="700">+14% Redwood City at noon</text>
        <text x="16" y="68" fill="rgba(200,216,240,0.7)" fontSize="11" fontFamily={F.body}>Pre-stage one extra driver and keep ETAs intact.</text>
        <text x="16" y="86" fill={C.green} fontSize="11" fontFamily={F.mono}>Coverage gap: solved</text>
      </g>
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
      <Surface
        style={{
          padding: stacked ? 18 : 20,
          animation: stacked ? undefined : 'lFloat 9s ease-in-out infinite',
          background: 'linear-gradient(180deg, rgba(10,19,33,0.98) 0%, rgba(7,14,24,0.98) 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '2px 4px 16px' }}>
          <div>
            <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Mission Control</div>
            <div style={{ marginTop: 10, fontFamily: F.display, fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em' }}>Routes, drivers, and exceptions in one frame.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['Fleet', 'AI', 'Forecast'].map((item, index) => (
              <span
                key={item}
                style={{
                  padding: '7px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(91,164,245,0.12)',
                  background: index === 0 ? 'rgba(91,164,245,0.16)' : 'rgba(255,255,255,0.03)',
                  color: index === 0 ? C.accent : 'rgba(200,216,240,0.62)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : '1.24fr 0.76fr', gap: 16 }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ overflow: 'hidden', borderRadius: 22, border: '1px solid rgba(91,164,245,0.12)', minHeight: stacked ? 300 : 430 }}>
              <FleetMap />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              {[
                { label: 'Routes rolling', value: '4', color: C.accent },
                { label: 'Customer pings', value: '38', color: C.green },
                { label: 'At-risk', value: '2', color: C.yellow },
              ].map((item) => (
                <div key={item.label} style={{ borderRadius: 16, border: `1px solid ${item.color}22`, background: 'rgba(255,255,255,0.03)', padding: '14px 14px 12px' }}>
                  <div style={{ fontSize: 10, color: 'rgba(200,216,240,0.54)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.label}</div>
                  <div style={{ marginTop: 6, fontFamily: F.display, fontWeight: 800, fontSize: 24, color: item.color, letterSpacing: '-0.04em' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateRows: stacked ? 'auto minmax(320px, auto)' : 'auto minmax(0, 1fr)', gap: 14 }}>
            <div style={{ borderRadius: 22, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', padding: '16px 16px 14px' }}>
              <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Hot routes</div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                {heroWatchlist.map((item) => (
                  <div key={item.route} style={{ padding: '12px 12px 10px', borderRadius: 16, border: `1px solid ${item.color}22`, background: `${item.color}0D` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontFamily: F.mono, fontSize: 11, color: C.text }}>{item.route}</div>
                      <span style={{ fontSize: 10, color: item.color, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{item.status}</span>
                    </div>
                    <div style={{ marginTop: 7, fontSize: 13, lineHeight: 1.6, color: 'rgba(200,216,240,0.72)' }}>{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ overflow: 'hidden', borderRadius: 22, border: '1px solid rgba(91,164,245,0.12)', minHeight: stacked ? 320 : 402 }}>
              <AIChatMockup compact={stacked} />
            </div>
          </div>
        </div>
      </Surface>

      {!stacked && (
        <>
          <SignalCard
            title="AI suggestion"
            detail="Traffic spike on El Camino Real. Dispatch can approve the recovery before the route actually slips."
            accent={C.yellow}
            style={{ top: 64, right: -26 }}
          />
          <SignalCard
            title="Tomorrow"
            detail="Redwood City runs hot between 10 AM and noon. One spare driver closes the gap."
            accent={C.purple}
            style={{ left: -18, bottom: 112 }}
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
      <div style={{ ...mx(1220), padding: compact ? '0 16px' : '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: compact ? 10 : 18, height: compact ? 64 : 78 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 10 : 14, minWidth: 0 }}>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontFamily: F.display,
              fontWeight: 800,
              fontSize: compact ? 24 : 32,
              letterSpacing: '-0.04em',
              color: C.text,
              flexShrink: 0,
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

        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 8 : 12, flexShrink: 0 }}>
          <button style={{ ...btnGhost, padding: compact ? '10px 12px' : '12px 20px', fontSize: compact ? 13 : 15 }} onClick={() => nav('/login')}>Login</button>
          <button style={{ ...btnAccent, padding: compact ? '10px 14px' : '12px 22px', fontSize: compact ? 13 : 15 }} onClick={() => nav('/register')}>Start Free</button>
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
      <div style={{ position: 'absolute', inset: '-4% auto auto -6%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,164,245,0.22) 0%, transparent 72%)', filter: 'blur(12px)', pointerEvents: 'none' }} />
      {!stacked && <div style={{ position: 'absolute', top: 96, right: '12%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />}
      <div style={mx(1240)}>
        <div style={{ display: 'grid', gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 0.8fr) minmax(660px, 1.2fr)', gap: stacked ? 34 : 32, alignItems: 'start' }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={eyebrowStyle}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
              Live dispatch OS for last-mile teams
            </div>

            <h1
              style={{
                margin: '22px 0 18px',
                fontFamily: F.display,
                fontWeight: 800,
                fontSize: stacked ? 'clamp(50px, 14vw, 72px)' : 'clamp(48px, 4.8vw, 68px)',
                lineHeight: 0.9,
                letterSpacing: '-0.05em',
                maxWidth: 540,
              }}
            >
              Run dispatch from one live control room.
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
              Routes, drivers, ETAs, exceptions, and customer updates stay in the same operating surface. HOMER combines route optimization, live dispatch, and an AI copilot that can actually execute.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
              <button style={btnAccent} onClick={() => nav('/register')}>Start Free</button>
              <a href="https://homer.discordwell.com/demo/" target="_blank" rel="noopener noreferrer" style={btnGhost}>Explore Demo</a>
            </div>

            <div style={{ marginTop: 18, color: 'rgba(200,216,240,0.68)', fontSize: 13, lineHeight: 1.7 }}>
              Start free with 100 orders per month. No credit card. Unlimited drivers on paid plans.
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              {heroModules.map((item) => (
                <span
                  key={item}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 999,
                    border: '1px solid rgba(91,164,245,0.14)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'rgba(200,216,240,0.74)',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: stacked ? 'repeat(2, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 28, maxWidth: 720 }}>
              {heroSignals.map((signal) => (
                <StatTile key={signal.label} value={signal.value} label={signal.label} detail={signal.detail} color={signal.color} />
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
                body="Monitor route state, driver progress, and emerging exceptions in one view. Dispatch does not need five tabs and a spreadsheet just to understand the day."
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
                body="Run optimization against real operating constraints: driver ownership, capacity, time windows, and urgent stops. Dispatch sees both the win and the reason behind it."
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
                <div style={{ ...eyebrowStyle, padding: '7px 10px', fontSize: 10 }}>Optimization rules</div>
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
                body="Use natural language to inspect risk, compare drivers, reassign work, and notify teams. The model stays grounded in live route data and asks for confirmation before destructive actions."
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
            body="Plans scale by monthly delivery volume, not seats or driver count. Busy days should not turn into a penalty for adding coverage."
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
                <div style={{ fontSize: 10, color: C.green, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800 }}>Why it works</div>
                <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.7, color: 'rgba(200,216,240,0.76)' }}>
                  One strong recommendation, clear savings, and unlimited drivers make the buying decision faster for operations teams.
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
                body="Bring over orders, drivers, vehicles, and historical routes from the tools you already use. Review the import before anything goes live."
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
              Put dispatch, routing, and AI in the same control room.
            </h2>

            <p style={{ margin: '0 auto', maxWidth: 720, color: 'rgba(200,216,240,0.74)', fontSize: 18, lineHeight: 1.7 }}>
              Start free with 100 orders, bring the team over fast, and give operators a system that can actually run the day instead of just reporting on it.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', marginTop: 26 }}>
              <button style={btnAccent} onClick={() => nav('/register')}>Start Free</button>
              <a href="https://homer.discordwell.com/demo/" target="_blank" rel="noopener noreferrer" style={btnGhost}>Explore Demo</a>
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
          <a href="https://homer.discordwell.com/demo/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>Demo</a>
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
