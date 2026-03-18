import { Link } from 'react-router-dom';
import { C } from '../../theme.js';
import {
  LandingF,
  Surface,
  containerStyle,
  primaryActionStyle,
  secondaryActionStyle,
} from './shared.js';

type MapPoint = [number, number];

const liveSignals = [
  { label: 'Approval-gated AI', color: C.accent },
  { label: 'Live route map', color: C.green },
  { label: 'Address intelligence', color: C.yellow },
];

const routeCards = [
  {
    label: 'Watch',
    route: 'RT-204',
    detail: 'Marcus · downtown cluster',
    tone: C.orange,
  },
  {
    label: 'Cover',
    route: 'RT-118',
    detail: 'Priya · can absorb 6 stops',
    tone: C.accent,
  },
  {
    label: 'Live',
    route: 'RT-091',
    detail: 'Sofia · ahead of schedule',
    tone: C.green,
  },
];

const roadPaths = [
  'M 80 62 C 170 120, 210 175, 320 226 S 510 312, 655 364',
  'M 154 44 C 236 116, 272 152, 370 195 S 534 246, 668 295',
  'M 118 202 C 206 184, 270 166, 344 148 S 522 120, 666 102',
  'M 110 322 C 212 300, 260 280, 352 240 S 548 182, 690 148',
];

const liveRoutes = [
  {
    id: 'RT-204',
    color: C.orange,
    points: [
      [138, 318],
      [182, 286],
      [248, 270],
      [324, 232],
      [412, 194],
      [496, 168],
      [590, 130],
    ] as MapPoint[],
  },
  {
    id: 'RT-118',
    color: C.accent,
    points: [
      [110, 246],
      [178, 236],
      [258, 220],
      [350, 198],
      [450, 182],
      [568, 176],
      [650, 192],
    ] as MapPoint[],
  },
  {
    id: 'RT-091',
    color: C.green,
    points: [
      [198, 92],
      [240, 118],
      [310, 158],
      [390, 210],
      [462, 244],
      [544, 286],
      [622, 328],
    ] as MapPoint[],
  },
];

export function HeroSection({ width }: { width: number }) {
  const stacked = width < 1040;
  const compact = width < 760;

  return (
    <section style={{ position: 'relative', padding: compact ? '56px 0 38px' : '74px 0 54px' }}>
      <div style={{ position: 'absolute', inset: '-2% auto auto -4%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,164,245,0.16), transparent 72%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
      <div style={{ ...containerStyle(1260), position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: stacked ? '1fr' : 'minmax(0, 0.82fr) minmax(560px, 1.18fr)',
            gap: stacked ? 30 : 28,
            alignItems: 'start',
          }}
        >
          <div style={{ paddingTop: stacked ? 0 : 16 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 14px',
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
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: '0 0 18px rgba(52,211,153,0.55)' }} />
              AI dispatch copilot for last-mile ops
            </div>

            <h1
              style={{
                margin: '22px 0 16px',
                fontFamily: LandingF.display,
                fontWeight: 800,
                fontSize: stacked ? 'clamp(46px, 12vw, 66px)' : 'clamp(52px, 5.6vw, 78px)',
                lineHeight: 0.94,
                letterSpacing: '-0.06em',
                maxWidth: 560,
              }}
            >
              Recover the route before customers feel the delay.
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 520,
                color: 'rgba(200,216,240,0.78)',
                fontSize: compact ? 17 : 18,
                lineHeight: 1.64,
              }}
            >
              A live map, a dispatch board, and an AI copilot that proposes the next move before a late route turns into a customer problem.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 28 }}>
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

            <div style={{ marginTop: 16, color: 'rgba(200,216,240,0.64)', fontSize: 13, lineHeight: 1.7 }}>
              Free plan includes 100 orders per month. Paid plans keep driver count out of the pricing model.
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
              {liveSignals.map((signal) => (
                <div key={signal.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 999, border: '1px solid rgba(91,164,245,0.12)', background: 'rgba(255,255,255,0.03)', color: 'rgba(200,216,240,0.72)', fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: signal.color, boxShadow: `0 0 16px ${signal.color}55` }} />
                  {signal.label}
                </div>
              ))}
            </div>
          </div>

          <MapShowcase compact={compact} />
        </div>
      </div>
    </section>
  );
}

function MapShowcase({ compact }: { compact: boolean }) {
  return (
    <Surface style={{ padding: compact ? 18 : 20 }}>
      <div className="landing-sweep" />
      <div className="landing-grid-accent" />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '2px 4px 16px' }}>
          <div>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Live operations map
            </div>
            <div style={{ marginTop: 10, fontFamily: LandingF.display, fontWeight: 800, fontSize: compact ? 28 : 34, letterSpacing: '-0.05em' }}>
              A simpler control room for the whole city.
            </div>
          </div>

          <div style={{ padding: '10px 12px', borderRadius: 16, border: '1px solid rgba(52,211,153,0.16)', background: 'rgba(52,211,153,0.08)' }}>
            <div style={{ fontSize: 10, color: C.green, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live state</div>
            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 700 }}>12 routes rolling · 3 need attention</div>
          </div>
        </div>

        <div style={{ overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(91,164,245,0.12)', minHeight: compact ? 350 : 500, position: 'relative', background: 'linear-gradient(180deg, #0A1322 0%, #08101B 100%)' }}>
          <svg
            viewBox="0 0 760 420"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
          >
            <defs>
              <linearGradient id="map-grid" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#122035" />
                <stop offset="100%" stopColor="#0A1322" />
              </linearGradient>
              <pattern id="route-grid" width="44" height="44" patternUnits="userSpaceOnUse">
                <path d="M 44 0 L 0 0 0 44" fill="none" stroke="rgba(144,176,214,0.08)" strokeWidth="1" />
              </pattern>
              <filter id="route-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            <rect width="760" height="420" fill="url(#map-grid)" />
            <rect width="760" height="420" fill="url(#route-grid)" opacity="0.42" />

            {roadPaths.map((path) => (
              <path key={path} d={path} fill="none" stroke="rgba(180,204,234,0.10)" strokeWidth="2" strokeLinecap="round" />
            ))}

            {liveRoutes.map((route) => (
              <g key={route.id}>
                <path d={svgPath(route.points)} fill="none" stroke={route.color} strokeWidth="10" strokeOpacity="0.18" strokeLinecap="round" strokeLinejoin="round" filter="url(#route-glow)" />
                <path d={svgPath(route.points)} fill="none" stroke={route.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                {route.points.map(([x, y], index) => (
                  <circle key={`${route.id}-${index}`} cx={x} cy={y} r={index === 0 || index === route.points.length - 1 ? 6 : 4} fill={route.color} stroke="#EAF2FF" strokeWidth="2" />
                ))}
              </g>
            ))}
          </svg>

          <div style={{ position: 'absolute', top: 14, left: 14, maxWidth: compact ? 'calc(100% - 28px)' : 280, padding: '12px 14px', borderRadius: 18, border: '1px solid rgba(91,164,245,0.14)', background: 'rgba(7,15,28,0.88)', backdropFilter: 'blur(18px)' }}>
            <div style={{ color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Copilot prompt</div>
            <div style={{ marginTop: 6, color: C.text, fontWeight: 700, fontSize: 14, lineHeight: 1.55 }}>
              Reassign the late downtown stops and queue updated ETAs before the route slips.
            </div>
          </div>

          <div style={{ position: 'absolute', right: 14, top: compact ? 92 : 14, padding: '12px 14px', borderRadius: 18, border: '1px solid rgba(52,211,153,0.16)', background: 'rgba(7,15,28,0.88)', backdropFilter: 'blur(18px)' }}>
            <div style={{ color: C.green, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Live map</div>
            <div style={{ marginTop: 6, color: C.text, fontFamily: LandingF.display, fontWeight: 800, fontSize: 26, letterSpacing: '-0.04em' }}>12</div>
            <div style={{ color: 'rgba(200,216,240,0.64)', fontSize: 12 }}>routes in motion</div>
          </div>

          <div style={{ position: 'absolute', left: 14, bottom: 14, display: 'grid', gap: 8, width: compact ? 'calc(100% - 28px)' : 260 }}>
            {routeCards.map((item) => (
              <div key={item.route} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 16, border: `1px solid ${item.tone}22`, background: 'rgba(7,15,28,0.84)', backdropFilter: 'blur(18px)' }}>
                <span style={{ width: 24, height: 4, borderRadius: 999, background: item.tone }} />
                <div>
                  <div style={{ fontSize: 10, color: item.tone, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{item.label}</div>
                  <div style={{ marginTop: 3, color: C.text, fontWeight: 700, fontSize: 13 }}>{item.route}</div>
                  <div style={{ marginTop: 3, color: 'rgba(200,216,240,0.64)', fontSize: 12 }}>{item.detail}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ position: 'absolute', right: 14, bottom: 14, width: compact ? 'calc(100% - 28px)' : 250, padding: '14px 14px 12px', borderRadius: 18, border: '1px solid rgba(251,191,36,0.16)', background: 'rgba(7,15,28,0.90)', backdropFilter: 'blur(18px)' }}>
            <div style={{ color: C.yellow, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Next move</div>
            <div style={{ marginTop: 8, color: C.text, fontWeight: 700, fontSize: 14, lineHeight: 1.55 }}>
              Move 6 stops to Priya and recover 18 minutes before the customer window slips.
            </div>
            <div style={{ marginTop: 10, color: 'rgba(200,216,240,0.60)', fontSize: 12 }}>Approval gate stays in the workflow.</div>
          </div>
        </div>
      </div>
    </Surface>
  );
}

function svgPath(points: MapPoint[]) {
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');
}
