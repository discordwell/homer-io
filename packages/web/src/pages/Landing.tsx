import { useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.js';
import { C, F } from '../theme.js';

/* ═══════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════ */

const competitorPricing = [
  { id: 'tookan', name: 'Tookan', perDriver: 39 },
  { id: 'onfleet', name: 'Onfleet', perDriver: 65 },
  { id: 'optimoroute', name: 'OptimoRoute', perDriver: 44 },
  { id: 'circuit', name: 'Circuit', perDriver: 40 },
  { id: 'other', name: 'Other tool', perDriver: 45 },
];

const plans = [
  { id: 'free', name: 'Free', mo: 0, yr: 0, orders: '100', popular: false, feat: ['All core features', 'AI copilot (10/mo)', 'Email notifications'] },
  { id: 'standard', name: 'Standard', mo: 149, yr: 119, orders: '1,000', popular: false, feat: ['All core features', 'AI copilot (10/mo)', 'Email + SMS', 'E-commerce integrations'] },
  { id: 'growth', name: 'Growth', mo: 349, yr: 279, orders: '5,000', popular: true, feat: ['All core features', 'AI copilot (10/mo)', 'Email + SMS', 'E-commerce integrations', 'Priority support'] },
  { id: 'scale', name: 'Scale', mo: 699, yr: 559, orders: '15,000', popular: false, feat: ['All core features', 'AI copilot (10/mo)', 'Email + SMS', 'E-commerce integrations', 'Priority support', 'Custom branding'] },
];

const migrationNames = ['Tookan', 'Onfleet', 'OptimoRoute', 'SpeedyRoute', 'GetSwift', 'Circuit'];

function bestPlan(drivers: number, annual: boolean) {
  if (drivers <= 10) return { name: 'Standard', price: annual ? 119 : 149 };
  if (drivers <= 30) return { name: 'Growth', price: annual ? 279 : 349 };
  return { name: 'Scale', price: annual ? 559 : 699 };
}

/* ═══════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════ */

function useScrolled(px = 40) {
  const [s, set] = useState(false);
  useEffect(() => {
    const fn = () => set(window.scrollY > px);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [px]);
  return s;
}

function useFadeIn(): { ref: React.RefObject<HTMLDivElement | null>; style: React.CSSProperties } {
  const ref = useRef<HTMLDivElement>(null);
  const [v, set] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { set(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return {
    ref,
    style: {
      opacity: v ? 1 : 0,
      transform: v ? 'none' : 'translateY(24px)',
      transition: 'opacity 0.6s ease, transform 0.6s ease',
    },
  };
}

function useWidth() {
  const [w, set] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const fn = () => { clearTimeout(timer); timer = setTimeout(() => set(window.innerWidth), 100); };
    window.addEventListener('resize', fn);
    return () => { clearTimeout(timer); window.removeEventListener('resize', fn); };
  }, []);
  return w;
}

/* ═══════════════════════════════════════════════════════
   GLOBAL CSS (keyframes + range slider)
   ═══════════════════════════════════════════════════════ */

const GlobalCSS = () => (
  <style>{`
@keyframes lFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
@keyframes lPulse{0%,100%{opacity:1}50%{opacity:.45}}
.l-slider{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:3px;background:${C.muted};outline:none;cursor:pointer}
.l-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:${C.accent};cursor:pointer;box-shadow:0 0 12px rgba(91,164,245,.4)}
.l-slider::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;background:${C.accent};cursor:pointer;box-shadow:0 0 12px rgba(91,164,245,.4)}
  `}</style>
);

/* ═══════════════════════════════════════════════════════
   SHARED STYLES
   ═══════════════════════════════════════════════════════ */

const mx = (max = 1140): React.CSSProperties => ({ maxWidth: max, margin: '0 auto', padding: '0 24px' });

const btnAccent: React.CSSProperties = {
  background: C.accent, color: '#fff', fontFamily: F.body, fontWeight: 600,
  fontSize: 15, padding: '12px 28px', borderRadius: 8, border: 'none', cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  background: 'transparent', color: C.text, fontFamily: F.body, fontWeight: 500,
  fontSize: 15, padding: '12px 28px', borderRadius: 8, border: `1px solid ${C.border}`, cursor: 'pointer',
};

/* ═══════════════════════════════════════════════════════
   1. STICKY NAV
   ═══════════════════════════════════════════════════════ */

function Nav() {
  const scrolled = useScrolled();
  const nav = useNavigate();
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? C.bg : 'transparent',
      borderBottom: scrolled ? `1px solid ${C.border}` : '1px solid transparent',
      transition: 'background .3s, border-color .3s',
      backdropFilter: scrolled ? 'blur(12px)' : undefined,
    }}>
      <div style={{ ...mx(), display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
        <span
          style={{ fontFamily: F.display, fontWeight: 700, fontSize: 22, color: C.accent, cursor: 'pointer' }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          HOMER.io
        </span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button style={btnGhost} onClick={() => nav('/login')}>Login</button>
          <button style={btnAccent} onClick={() => nav('/register')}>Start Free</button>
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════════════════════
   FLEET MAP SVG (hero left panel)
   ═══════════════════════════════════════════════════════ */

function FleetMap() {
  return (
    <svg viewBox="0 0 520 360" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
      <rect width="520" height="360" fill={C.bg2} />
      {/* grid */}
      {Array.from({ length: 8 }, (_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 52} x2="520" y2={i * 52} stroke={C.border} strokeWidth=".5" />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <line key={`v${i}`} x1={i * 52} y1="0" x2={i * 52} y2="360" stroke={C.border} strokeWidth=".5" />
      ))}
      {/* route paths */}
      <path d="M60,290 Q130,210 200,230 T350,160 T460,90" stroke={C.accent} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M80,60 Q170,130 220,190 T370,260 T470,300" stroke={C.green} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M40,180 Q130,140 220,100 T380,80" stroke={C.orange} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".85" />
      <path d="M100,330 Q210,270 300,310 T460,210" stroke={C.purple} strokeWidth="2.5" fill="none" strokeLinecap="round" opacity=".85" />
      {/* driver dots */}
      {[
        { cx: 200, cy: 230, fill: C.accent },
        { cx: 350, cy: 160, fill: C.accent },
        { cx: 220, cy: 190, fill: C.green },
        { cx: 370, cy: 260, fill: C.green },
        { cx: 220, cy: 100, fill: C.orange },
        { cx: 300, cy: 310, fill: C.purple },
        { cx: 460, cy: 210, fill: C.purple },
        { cx: 460, cy: 90, fill: C.accent },
      ].map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="5" fill={d.fill} style={{ animation: `lPulse 2s ease-in-out ${i * 0.25}s infinite` }} />
      ))}
      {/* labels */}
      <text x="48" y="288" fill={C.dim} fontSize="8" fontFamily={F.mono}>Warehouse A</text>
      <text x="68" y="54" fill={C.dim} fontSize="8" fontFamily={F.mono}>Depot B</text>
      <text x="420" y="84" fill={C.dim} fontSize="8" fontFamily={F.mono}>Zone North</text>
      <text x="420" y="306" fill={C.dim} fontSize="8" fontFamily={F.mono}>Zone South</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════
   AI CHAT MOCKUP (hero right panel + section 5)
   ═══════════════════════════════════════════════════════ */

function AIChatMockup({ large }: { large?: boolean }) {
  const pad = large ? 20 : 14;
  const fs = large ? 13 : 11.5;
  return (
    <div style={{
      background: C.bg3, borderRadius: large ? 8 : 0, padding: pad,
      display: 'flex', flexDirection: 'column', gap: large ? 14 : 10,
      fontFamily: F.body, fontSize: fs, color: C.text, height: '100%', boxSizing: 'border-box',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: large ? 10 : 6, borderBottom: `1px solid ${C.border}` }}>
        <span style={{ color: C.accent, fontSize: large ? 16 : 13 }}>✦</span>
        <span style={{ fontWeight: 700, color: C.accent, fontSize: large ? 14 : 12 }}>HOMER AI</span>
      </div>
      {/* user message */}
      <div style={{ alignSelf: 'flex-end', background: C.muted, borderRadius: 10, padding: '8px 12px', maxWidth: '85%' }}>
        {large ? 'Which driver is closest to 815 Marshall St?' : 'Reassign the late deliveries to Kai'}
      </div>
      {/* homer response */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(large ? ['find_drivers', 'geocode', 'calculate_eta'] : ['find_orders', 'reassign_orders']).map(t => (
            <span key={t} style={{ fontSize: large ? 10 : 9, background: C.muted, color: C.dim, borderRadius: 4, padding: '2px 7px' }}>{t}</span>
          ))}
        </div>
        <div style={{ color: C.text, lineHeight: 1.5 }}>
          {large
            ? <>Marcus is 0.8 mi away — ETA 4 min. <span style={{ color: C.accent }}>Assign?</span></>
            : <>Done. 3 orders reassigned to Kai.<br /><span style={{ color: C.accent }}>New ETA: 14 min</span></>
          }
        </div>
      </div>
      {large && (
        <>
          {/* second exchange */}
          <div style={{ alignSelf: 'flex-end', background: C.muted, borderRadius: 10, padding: '8px 12px', maxWidth: '85%' }}>
            Yes, assign to Marcus
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['assign_order', 'notify_driver'].map(t => (
                <span key={t} style={{ fontSize: 10, background: C.muted, color: C.dim, borderRadius: 4, padding: '2px 7px' }}>{t}</span>
              ))}
            </div>
            <div style={{ color: C.text, lineHeight: 1.5 }}>
              <span style={{ color: C.green }}>✓</span> Order assigned to Marcus. SMS sent.<br />
              <span style={{ color: C.dim, fontSize: 12 }}>Pickup ETA 4 min · Delivery ETA 18 min</span>
            </div>
          </div>
          {/* third exchange */}
          <div style={{ alignSelf: 'flex-end', background: C.muted, borderRadius: 10, padding: '8px 12px', maxWidth: '85%' }}>
            Reassign RT-003 to Priya
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['get_order', 'reassign_order', 'notify_driver'].map(t => (
                <span key={t} style={{ fontSize: 10, background: C.muted, color: C.dim, borderRadius: 4, padding: '2px 7px' }}>{t}</span>
              ))}
            </div>
            <div style={{
              background: C.bg2, borderRadius: 6, padding: '8px 12px', border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ color: C.green, fontSize: 14 }}>✓</span>
              <span>RT-003 reassigned to Priya. ETA updated.</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   2. HERO
   ═══════════════════════════════════════════════════════ */

function Hero({ w }: { w: number }) {
  const nav = useNavigate();
  const stack = w < 900;
  return (
    <section style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div style={mx(1140)}>
        {/* headline */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: F.display, fontWeight: 800, fontSize: stack ? 36 : 52, lineHeight: 1.1, margin: 0 }}>
            Delivery logistics that doesn't{!stack && <br />} look like <span style={{ color: C.dim, textDecoration: 'line-through' }}>2018</span>.
          </h1>
          <p style={{ color: C.dim, fontSize: stack ? 16 : 19, maxWidth: 620, margin: '20px auto 0', lineHeight: 1.6 }}>
            Route optimization, real-time tracking, and an AI copilot that actually runs your fleet. Start free.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 28, flexWrap: 'wrap' }}>
            <button style={btnAccent} onClick={() => nav('/register')}>Start Free</button>
            <a
              href="https://homer.discordwell.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
            >
              Explore Demo
            </a>
          </div>
          <p style={{ color: C.dim, fontSize: 13, marginTop: 14 }}>Free forever · 100 orders/month · No credit card</p>
        </div>
        {/* split-panel mockup */}
        <div style={{
          display: 'flex', flexDirection: stack ? 'column' : 'row',
          background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 12,
          overflow: 'hidden', boxShadow: C.accentGlow,
          animation: 'lFloat 3s ease-in-out infinite',
        }}>
          <div style={{ flex: stack ? 'none' : '0 0 60%', minHeight: stack ? 220 : 340 }}>
            <FleetMap />
          </div>
          <div style={{ flex: 1, borderLeft: stack ? 'none' : `1px solid ${C.border}`, borderTop: stack ? `1px solid ${C.border}` : 'none' }}>
            <AIChatMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════
   3. SEE EVERYTHING. CONTROL EVERYTHING.
   ═══════════════════════════════════════════════════════ */

function SeeEverything({ w }: { w: number }) {
  const fi = useFadeIn();
  const stack = w < 768;
  return (
    <div ref={fi.ref} style={{ ...fi.style, padding: '80px 0' }}>
      <div style={{ ...mx(), display: 'flex', flexDirection: stack ? 'column' : 'row', gap: 48, alignItems: 'center' }}>
        {/* copy */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, margin: '0 0 16px' }}>
            See everything. Control everything.
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              'Real-time driver positions on a live map',
              'Event feed — every pickup, delivery, and delay',
              'Driver status: active, idle, returning, offline',
              'Drag-and-drop dispatch board',
            ].map((t, i) => (
              <li key={i} style={{ color: C.dim, fontSize: 15, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: C.accent, fontSize: 13, marginTop: 3 }}>▸</span> {t}
              </li>
            ))}
          </ul>
        </div>
        {/* dispatch board mockup */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: 'flex', gap: 12 }}>
            {[
              { title: 'Queued', color: C.yellow, cards: [{ id: 'RT-007', stops: 4, driver: '' }, { id: 'RT-008', stops: 3, driver: '' }] },
              { title: 'In Transit', color: C.accent, cards: [{ id: 'RT-003', stops: 6, driver: 'Marcus' }, { id: 'RT-005', stops: 5, driver: 'Kai' }] },
              { title: 'Delivered', color: C.green, cards: [{ id: 'RT-001', stops: 8, driver: 'Priya' }] },
            ].map(col => (
              <div key={col.title} style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: col.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {col.title}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.cards.map(c => (
                    <div key={c.id} style={{ background: C.bg3, borderRadius: 6, padding: 10, border: `1px solid ${C.border}` }}>
                      <div style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 600, marginBottom: 4 }}>{c.id}</div>
                      <div style={{ fontSize: 10, color: C.dim }}>{c.stops} stops</div>
                      <div style={{ fontSize: 10, color: c.driver ? C.accent : C.dim, marginTop: 2 }}>{c.driver || 'Unassigned'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   4. ONE CLICK. FASTER ROUTES.
   ═══════════════════════════════════════════════════════ */

function FasterRoutes({ w }: { w: number }) {
  const fi = useFadeIn();
  const stack = w < 768;
  const stops = [
    { x: 40, y: 30 }, { x: 160, y: 20 }, { x: 170, y: 140 },
    { x: 30, y: 160 }, { x: 100, y: 90 }, { x: 140, y: 170 },
  ];
  return (
    <div ref={fi.ref} style={{ ...fi.style, padding: '80px 0' }}>
      <div style={mx()}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, margin: '0 0 12px' }}>
            One click. Faster routes.
          </h2>
          <p style={{ color: C.dim, fontSize: 16, maxWidth: 520, margin: '0 auto' }}>
            OSRM-powered route optimization with vehicle capacity constraints. Drop your stops, click optimize.
          </p>
        </div>
        {/* before / after */}
        <div style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', gap: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 40 }}>
          {/* before */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Before</div>
            <svg viewBox="0 0 200 200" width={stack ? 180 : 200} height={stack ? 180 : 200}>
              <rect width="200" height="200" fill={C.bg2} rx="8" />
              <path d="M40,30 L170,140" stroke={C.red} strokeWidth="1.5" fill="none" opacity=".5" />
              <path d="M160,20 L30,160" stroke={C.red} strokeWidth="1.5" fill="none" opacity=".5" />
              <path d="M40,30 L140,170" stroke={C.red} strokeWidth="1.5" fill="none" opacity=".5" />
              <path d="M160,20 L100,90 L30,160" stroke={C.red} strokeWidth="1.5" fill="none" opacity=".5" />
              <path d="M170,140 L140,170" stroke={C.red} strokeWidth="1.5" fill="none" opacity=".5" />
              <path d="M100,90 L170,140" stroke={C.red} strokeWidth="1.5" fill="none" opacity=".5" />
              {stops.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r="6" fill={C.bg3} stroke={C.red} strokeWidth="1.5" />)}
              {stops.map((s, i) => <text key={`t${i}`} x={s.x} y={s.y + 4} textAnchor="middle" fill={C.dim} fontSize="8" fontFamily={F.mono}>{i + 1}</text>)}
            </svg>
          </div>
          {/* arrow */}
          <div style={{ fontSize: 28, color: C.accent }}>→</div>
          {/* after */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>After</div>
            <svg viewBox="0 0 200 200" width={stack ? 180 : 200} height={stack ? 180 : 200}>
              <rect width="200" height="200" fill={C.bg2} rx="8" />
              <path d="M40,30 L160,20 L170,140 L140,170 L30,160 L100,90 L40,30" stroke={C.green} strokeWidth="2" fill="none" strokeLinejoin="round" />
              {stops.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r="6" fill={C.bg3} stroke={C.green} strokeWidth="1.5" />)}
              {stops.map((s, i) => <text key={`t${i}`} x={s.x} y={s.y + 4} textAnchor="middle" fill={C.text} fontSize="8" fontFamily={F.mono}>{i + 1}</text>)}
            </svg>
          </div>
        </div>
        {/* stats */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { value: '-22%', label: 'Drive time', color: C.accent },
            { value: '-18%', label: 'Fuel cost', color: C.green },
            { value: '94%', label: 'On-time delivery', color: C.purple },
          ].map(s => (
            <div key={s.label} style={{
              background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '20px 32px', textAlign: 'center',
            }}>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 28, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   5. ASK IT ANYTHING ABOUT YOUR FLEET.
   ═══════════════════════════════════════════════════════ */

function AskAnything({ w }: { w: number }) {
  const fi = useFadeIn();
  return (
    <div ref={fi.ref} style={{ ...fi.style, padding: '80px 0' }}>
      <div style={{ ...mx(800), textAlign: 'center' }}>
        <h2 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, margin: '0 0 12px' }}>
          Ask it anything about your fleet.
        </h2>
        <p style={{ color: C.dim, fontSize: 16, margin: '0 0 32px' }}>
          19 fleet operations. Plain English. Confirmation before anything destructive.
        </p>
        <div style={{
          background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: w < 640 ? 12 : 20, maxWidth: 560, margin: '0 auto',
          boxShadow: C.accentGlow,
        }}>
          <AIChatMockup large />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   6. PRICING — CALCULATOR + PLAN CARDS
   ═══════════════════════════════════════════════════════ */

function PricingSection({ w }: { w: number }) {
  const fi = useFadeIn();
  const nav = useNavigate();
  const [drivers, setDrivers] = useState(15);
  const [compIdx, setCompIdx] = useState(0);
  const [annual, setAnnual] = useState(false);
  const stack = w < 640;

  const comp = competitorPricing[compIdx];
  const currentCost = drivers * comp.perDriver;
  const homer = bestPlan(drivers, annual);
  const savings = currentCost - homer.price;

  return (
    <div ref={fi.ref} style={{ ...fi.style, padding: '80px 0' }}>
      <div style={mx()}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, margin: '0 0 12px' }}>
            Pay for deliveries, not drivers.
          </h2>
          <p style={{ color: C.dim, fontSize: 16 }}>Unlimited drivers on every plan. Flat monthly pricing.</p>
        </div>

        {/* calculator */}
        <div style={{
          background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: stack ? 24 : 32, maxWidth: 600, margin: '0 auto 48px',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14, color: C.dim }}>Drivers</span>
              <span style={{ fontFamily: F.mono, fontWeight: 700, fontSize: 18 }}>{drivers}</span>
            </div>
            <input
              type="range" className="l-slider" min={5} max={50} value={drivers}
              aria-label="Number of drivers"
              onChange={e => setDrivers(+e.target.value)}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, color: C.dim, marginBottom: 8 }}>Current tool</div>
            <select
              value={compIdx}
              onChange={e => setCompIdx(+e.target.value)}
              aria-label="Current delivery tool"
              style={{
                width: '100%', background: C.bg3, color: C.text, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: F.body, outline: 'none', cursor: 'pointer',
              }}
            >
              {competitorPricing.map((c, i) => (
                <option key={c.id} value={i}>{c.name} (~${c.perDriver}/driver/mo)</option>
              ))}
            </select>
          </div>
          {/* comparison */}
          <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{comp.name}</div>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, color: C.red, textDecoration: 'line-through', transition: 'all .3s' }}>
                ${currentCost.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>/month</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>HOMER {homer.name}</div>
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, color: C.green, transition: 'all .3s' }}>
                ${homer.price}
              </div>
              <div style={{ fontSize: 12, color: C.dim }}>/month</div>
            </div>
          </div>
          {savings > 0 && (
            <div style={{
              marginTop: 16, textAlign: 'center', background: 'rgba(52,211,153,.1)', borderRadius: 8,
              padding: '10px 16px', color: C.green, fontWeight: 700, fontSize: 15, transition: 'all .3s',
            }}>
              Save ${savings.toLocaleString()}/month
            </div>
          )}
        </div>

        {/* monthly / annual toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', background: C.bg2, borderRadius: 8, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {(['Monthly', 'Annual'] as const).map(label => {
              const active = label === 'Annual' ? annual : !annual;
              return (
                <button
                  key={label}
                  onClick={() => setAnnual(label === 'Annual')}
                  style={{
                    padding: '8px 20px', fontSize: 13, fontWeight: 600, fontFamily: F.body,
                    background: active ? C.accent : 'transparent', color: active ? '#fff' : C.dim,
                    border: 'none', cursor: 'pointer', transition: 'background .2s, color .2s',
                  }}
                >
                  {label}{label === 'Annual' ? ' (save ~20%)' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: stack ? '1fr' : w < 900 ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16 }}>
          {plans.map(p => (
            <div key={p.id} style={{
              background: C.bg2, border: `1px solid ${p.popular ? C.accent : C.border}`, borderRadius: 12,
              padding: 24, position: 'relative', display: 'flex', flexDirection: 'column',
              boxShadow: p.popular ? C.accentGlow : undefined,
            }}>
              {p.popular && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: C.accent, color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '3px 12px', borderRadius: 10, textTransform: 'uppercase', letterSpacing: 1,
                }}>Popular</div>
              )}
              <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{p.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span style={{ fontFamily: F.display, fontWeight: 800, fontSize: 36 }}>
                  ${annual ? p.yr : p.mo}
                </span>
                <span style={{ color: C.dim, fontSize: 14 }}>/mo</span>
              </div>
              <div style={{ color: C.accent, fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
                {p.orders} orders/month
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 16 }}>
                ∞ Unlimited drivers
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', flex: 1 }}>
                {p.feat.map((f, i) => (
                  <li key={i} style={{ fontSize: 12, color: C.dim, padding: '3px 0', display: 'flex', gap: 6 }}>
                    <span style={{ color: C.green }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              <button
                style={{ ...btnAccent, width: '100%', fontSize: 13, padding: '10px 0' }}
                onClick={() => nav('/register')}
              >
                {p.id === 'free' ? 'Start Free' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', color: C.dim, fontSize: 14, marginTop: 24 }}>
          Need more? <a href="mailto:hello@homer.io" style={{ color: C.accent, textDecoration: 'none' }}>Talk to us.</a>
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   7. SWITCH IN 5 MINUTES
   ═══════════════════════════════════════════════════════ */

function MigrationSection() {
  const fi = useFadeIn();
  return (
    <div ref={fi.ref} style={{ ...fi.style, padding: '60px 0' }}>
      <div style={{ ...mx(800), textAlign: 'center' }}>
        <h2 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 32, margin: '0 0 20px' }}>
          Switch in 5 minutes.
        </h2>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          {migrationNames.map(n => (
            <span key={n} style={{
              background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '6px 14px', fontSize: 13, color: C.dim,
            }}>
              {n}
            </span>
          ))}
        </div>
        <p style={{ color: C.dim, fontSize: 15, lineHeight: 1.6 }}>
          Import via API or CSV. Your orders, drivers, and vehicles — migrated automatically.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   8. FINAL CTA + FOOTER
   ═══════════════════════════════════════════════════════ */

function FinalCTA() {
  const fi = useFadeIn();
  const nav = useNavigate();
  return (
    <div ref={fi.ref} style={{ ...fi.style, padding: '80px 0', textAlign: 'center' }}>
      <h2 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 36, margin: '0 0 24px' }}>
        Start dispatching today.
      </h2>
      <button style={{ ...btnAccent, fontSize: 17, padding: '14px 36px' }} onClick={() => nav('/register')}>
        Start Free
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, padding: '32px 0' }}>
      <div style={{ ...mx(), display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <span style={{ fontFamily: F.display, fontWeight: 700, color: C.accent, fontSize: 16 }}>HOMER.io</span>
        <div style={{ display: 'flex', gap: 20, fontSize: 13, color: C.dim }}>
          <Link to="/login" style={{ color: C.dim, textDecoration: 'none' }}>Login</Link>
          <Link to="/register" style={{ color: C.dim, textDecoration: 'none' }}>Register</Link>
          <a href="https://homer.discordwell.com" target="_blank" rel="noopener noreferrer" style={{ color: C.dim, textDecoration: 'none' }}>Demo</a>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>© 2026 HOMER.io</span>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE EXPORT
   ═══════════════════════════════════════════════════════ */

export function LandingPage() {
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const w = useWidth();
  if (isAuth) return <Navigate to="/dashboard" replace />;
  return (
    <>
      <GlobalCSS />
      <Nav />
      <Hero w={w} />
      <SeeEverything w={w} />
      <FasterRoutes w={w} />
      <AskAnything w={w} />
      <PricingSection w={w} />
      <MigrationSection />
      <FinalCTA />
      <Footer />
    </>
  );
}
