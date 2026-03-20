import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HeroMap } from './HeroMap.js';
import { useHeroGeolocation } from './useHeroGeolocation.js';
import { getNearestCity } from './nearestCity.js';
import './home.css';

/* ---- Scroll reveal ---- */

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('visible'); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

/* ---- Nav ---- */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`hp-nav ${scrolled ? 'scrolled' : ''}`}>
      <Link to="/" className="hp-nav-logo">HOMER<span>.</span></Link>
      <ul className="hp-nav-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><Link to="/login">Log in</Link></li>
      </ul>
      <Link to="/register" className="hp-nav-cta">Start free</Link>
    </nav>
  );
}

/* ---- Chat Preview (auto-playing) ---- */

function ChatPreview({ city = 'Oakland' }: { city?: string }) {
  const [cycle, setCycle] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const delays = [800, 2400, 4000, 6800, 8500, 10200];
    const timers = delays.map((d, i) => setTimeout(() => setStep(i + 1), d));
    const reset = setTimeout(() => setCycle(c => c + 1), 15000);
    return () => { timers.forEach(clearTimeout); clearTimeout(reset); };
  }, [cycle]);

  return (
    <div className="chat-preview">
      <div className="chat-head">
        <span className="dot" />
        <span>HOMER copilot</span>
      </div>
      <div className="chat-body">
        {step >= 1 && (
          <div className="c-msg user">3 new pickups in {city}. Who&apos;s nearby?</div>
        )}
        {step === 2 && (
          <div className="c-typing"><i /><i /><i /></div>
        )}
        {step >= 3 && (
          <div className="c-msg homer">
            <div className="c-tool">Checked 4 active drivers</div>
            <div className="c-tool">Calculated proximity</div>
            <div style={{ marginTop: 6 }}>
              Marcus Chen is <strong style={{ color: 'var(--t1)' }}>0.8 mi away</strong> on
              Route&nbsp;#847 with room for 3 more stops. Want me to add them?
            </div>
          </div>
        )}
        {step >= 4 && (
          <div className="c-msg user">Do it, and notify the customers</div>
        )}
        {step === 5 && (
          <div className="c-typing"><i /><i /><i /></div>
        )}
        {step >= 6 && (
          <div className="c-msg homer">
            <div className="c-tool">Added 3 stops to Route #847</div>
            <div className="c-tool">Re-optimized route</div>
            <div className="c-tool">Sent 3 customer notifications</div>
            <div style={{ marginTop: 6 }}>
              Done. Marcus&apos;s new ETA: <strong style={{ color: 'var(--t1)' }}>4:45 PM</strong>.
              All customers notified with updated windows.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Hero ---- */

function Hero() {
  const geo = useHeroGeolocation();
  const city = getNearestCity(geo.lat, geo.lng);

  return (
    <section className="hero">
      <div className="hero-map-wrap"><HeroMap geo={geo} /></div>
      <div className="hero-overlay" />
      <div className="hero-content">
        <div className="hero-text">
          <span className="hero-eyebrow">AI Dispatch Copilot</span>
          <h1 className="hero-h1">
            Talk to<br />your <em>fleet</em>.
          </h1>
          <p className="hero-sub">
            Tell HOMER what you need&mdash;routing, dispatch, driver&nbsp;coordination,
            customer&nbsp;updates. Like having a senior dispatcher who never&nbsp;sleeps.
          </p>
          <div className="hero-buttons">
            <Link to="/register" className="btn-primary">Start free &rarr;</Link>
            {/* human-requested: CTA links to interactive demo */}
            <Link to="/demo" className="btn-outline">See how it works</Link>
          </div>
        </div>
        <ChatPreview city={city} />
      </div>
      <div className="hero-scroll">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  );
}

/* ---- Proof strip ---- */

function ProofStrip() {
  return (
    <div className="proof-strip">
      <span><span className="live-dot" /> LIVE</span>
      <span className="sep">|</span>
      <span>12 drivers active</span>
      <span className="sep">|</span>
      <span>47 deliveries today</span>
      <span className="sep">|</span>
      <span>98.2% on-time</span>
      <span className="sep">|</span>
      <span>Bay Area, CA</span>
    </div>
  );
}

/* ---- NLOps section ---- */

function NLOpsSection() {
  return (
    <div className="hp-section" id="nlops">
      <Reveal>
        <div className="nlops">
          <div className="nlops-demo">
            <div className="nlops-demo-header">
              <span className="circle" />
              <span>HOMER &mdash; natural language operations</span>
            </div>
            <div className="nlops-demo-body">
              <div className="c-msg user" style={{ animation: 'none' }}>
                Marcus called in sick. Reassign his afternoon route.
              </div>
              <div className="c-msg homer" style={{ animation: 'none' }}>
                <div className="c-tool">Found Route #847 &mdash; Marcus Chen</div>
                <div className="c-tool">12 stops remaining, 3 priority</div>
                <div className="c-tool">Checking available drivers</div>
                <div style={{ marginTop: 8 }}>
                  I recommend splitting the route:
                  <br /><br />
                  <strong style={{ color: 'var(--t1)' }}>Lisa Park</strong> &mdash; 3 priority stops
                  (she&apos;s closer, finishes at 1:30 PM)
                  <br />
                  <strong style={{ color: 'var(--t1)' }}>James Wu</strong> &mdash; 9 remaining stops
                  (available, 8 mi away)
                  <br /><br />
                  Want me to proceed?
                </div>
              </div>
              <div className="c-msg user" style={{ animation: 'none' }}>
                Yes, and let the customers know about the driver change
              </div>
              <div className="c-msg homer" style={{ animation: 'none' }}>
                <div className="c-tool">Moved 3 stops to Route #852 (Lisa Park)</div>
                <div className="c-tool">Created Route #858 for James Wu</div>
                <div className="c-tool">Both routes optimized</div>
                <div className="c-tool">Sent driver change notifications to 12 customers</div>
                <div style={{ marginTop: 8 }}>
                  All set. Lisa&apos;s first new stop is at{' '}
                  <strong style={{ color: 'var(--t1)' }}>1:45 PM</strong>.
                </div>
              </div>
            </div>
          </div>
          <div className="nlops-text">
            <span className="hp-eyebrow">Natural Language Operations</span>
            <h2 className="hp-h2">Dispatch in plain English</h2>
            <p className="hp-body">
              No menus. No dropdowns. Tell HOMER what you need and it
              executes&mdash;checking real-time fleet state, running multi-step
              operations, and confirming before any changes go live.
            </p>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Learning section ---- */

function LearningSection() {
  return (
    <div className="hp-section" id="learning">
      <Reveal>
        <div className="learning">
          <div className="learning-text">
            <span className="hp-eyebrow">Address Intelligence</span>
            <h2 className="hp-h2">Every delivery makes it smarter</h2>
            <p className="hp-body">
              HOMER learns from every drop-off. Gate codes, parking tips,
              customer&nbsp;preferences, failure&nbsp;patterns&mdash;all fed back into
              routing and risk scoring. Your 100th delivery to a building is seamless
              because HOMER remembers the first&nbsp;99.
            </p>
          </div>
          <div className="address-card">
            <div className="address-card-header">
              <span className="pin">&#x1F4CD;</span>
              <span className="addr">1847 Broadway, Oakland CA</span>
            </div>
            <div className="address-card-stats">
              <div className="address-card-stat">
                <span className="val">47</span>
                <span className="lbl">Deliveries</span>
              </div>
              <div className="address-card-stat">
                <span className="val">91%</span>
                <span className="lbl">Success rate</span>
              </div>
              <div className="address-card-stat">
                <span className="val">4.2m</span>
                <span className="lbl">Avg service</span>
              </div>
            </div>
            <div className="address-card-notes">
              <div className="address-card-note">
                <span className="ico">&#x1F511;</span>
                <span>
                  Gate code #4521{' '}
                  <span style={{ color: 'var(--t3)', fontSize: 11 }}>(updated 3 days ago)</span>
                </span>
              </div>
              <div className="address-card-note">
                <span className="ico">&#x1F17F;&#xFE0F;</span>
                <span>Loading zone on 19th St &mdash; 2hr max</span>
              </div>
              <div className="address-card-note">
                <span className="ico">&#x1F415;</span>
                <span>Dog in yard. Use side entrance.</span>
              </div>
              <div className="address-card-note">
                <span className="ico">&#x23F0;</span>
                <span>
                  Best hours: 10am&ndash;2pm{' '}
                  <span style={{ color: 'var(--green)' }}>(89% success)</span>
                </span>
              </div>
            </div>
            <div className="address-card-risk">
              <span style={{
                fontFamily: 'var(--fm)',
                fontSize: 11,
                color: 'var(--t3)',
                letterSpacing: '0.05em',
              }}>RISK SCORE</span>
              <span className="risk-badge low">&#x25CF; 12/100 &mdash; Low</span>
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Feature icons (inline SVG) ---- */

const icons = {
  route: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="4" cy="4" r="2" /><circle cx="16" cy="16" r="2" />
      <path d="M6 4h4a4 4 0 0 1 4 4v2a4 4 0 0 1-4 4H6" />
    </svg>
  ),
  tracking: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="10" cy="10" r="3" /><circle cx="10" cy="10" r="7" opacity="0.4" />
      <line x1="10" y1="1" x2="10" y2="4" /><line x1="10" y1="16" x2="10" y2="19" />
      <line x1="1" y1="10" x2="4" y2="10" /><line x1="16" y1="10" x2="19" y2="10" />
    </svg>
  ),
  pod: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <polyline points="7 10 9 12 13 8" />
    </svg>
  ),
  notify: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 8a5 5 0 0 1 10 0c0 4 2 6 2 6H3s2-2 2-6" />
      <path d="M8.5 16a2 2 0 0 0 3 0" />
    </svg>
  ),
  chart: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="10" width="3" height="7" rx="1" /><rect x="8.5" y="6" width="3" height="11" rx="1" />
      <rect x="14" y="3" width="3" height="14" rx="1" />
    </svg>
  ),
  plug: (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M7 3v4M13 3v4M5 7h10a1 1 0 0 1 1 1v2a5 5 0 0 1-5 5h0a5 5 0 0 1-5-5V8a1 1 0 0 1 1-1z" />
      <line x1="10" y1="15" x2="10" y2="18" />
    </svg>
  ),
};

/* ---- Features section ---- */

function FeaturesSection() {
  const features = [
    { icon: icons.route,    title: 'Route Optimization',  desc: 'Real road-network routing with OSRM + VRP solver. Not crow-flies estimates.' },
    { icon: icons.tracking, title: 'Live Tracking',       desc: 'Every driver, every second. Geofencing, auto-arrival detection, live ETAs.' },
    { icon: icons.pod,      title: 'Proof of Delivery',   desc: 'Photos, signatures, GPS stamps. Complete chain of custody for every package.' },
    { icon: icons.notify,   title: 'Customer Updates',    desc: 'Automated SMS and email at every stage. Customizable templates.' },
    { icon: icons.chart,    title: 'Analytics',           desc: 'Driver leaderboards, route efficiency, carbon tracking, PDF reports.' },
    { icon: icons.plug,     title: 'Integrations',        desc: 'Shopify, WooCommerce, webhooks. Migrate from Tookan, Onfleet, and more.' },
  ];

  return (
    <div className="hp-section" id="features">
      <Reveal>
        <div className="features-heading">
          <span className="hp-eyebrow">Capabilities</span>
          <h2 className="hp-h2">Everything to run your fleet</h2>
        </div>
      </Reveal>
      <Reveal>
        <div className="feature-grid">
          {features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Pricing ---- */

function PricingSection() {
  const plans = [
    { name: 'Free',     price: '$0',   per: '',    orders: '100 orders/mo',    cta: 'Start free',  primary: false, popular: false },
    { name: 'Standard', price: '$149', per: '/mo', orders: '1,000 orders/mo',  cta: 'Start trial', primary: false, popular: false },
    { name: 'Growth',   price: '$349', per: '/mo', orders: '5,000 orders/mo',  cta: 'Start trial', primary: true,  popular: true },
    { name: 'Scale',    price: '$699', per: '/mo', orders: '15,000 orders/mo', cta: 'Contact us',  primary: false, popular: false },
  ];

  return (
    <div className="hp-section-full" id="pricing" style={{
      background: 'linear-gradient(180deg, #06090F 0%, #0A1018 50%, #06090F 100%)',
    }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <Reveal>
          <div className="pricing-heading">
            <span className="hp-eyebrow">Pricing</span>
            <h2 className="hp-h2">Unlimited drivers. Pay per order.</h2>
            <p className="hp-body">
              Every feature at every tier. No per-seat charges. No feature gates. Just volume.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <div className="pricing-grid">
            {plans.map((p) => (
              <div className={`pricing-card ${p.popular ? 'popular' : ''}`} key={p.name}>
                {p.popular && <span className="pricing-badge">Most popular</span>}
                <div className="plan-name">{p.name}</div>
                <div className="plan-price">{p.price}<span className="mo">{p.per}</span></div>
                <div className="plan-orders">{p.orders}</div>
                <ul className="plan-features">
                  <li>Unlimited drivers</li>
                  <li>All features included</li>
                  <li>AI dispatch copilot</li>
                  <li>Route optimization</li>
                  <li>Real-time tracking</li>
                </ul>
                <Link to="/register" className={`plan-cta ${p.primary ? 'primary' : 'secondary'}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="pricing-note">
            Annual billing saves 20%. Need more volume?{' '}
            <a href="mailto:hello@homer.io">Talk to us</a>.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

/* ---- Final CTA ---- */

function FinalCTA() {
  return (
    <div className="final-cta">
      <Reveal>
        <h2 className="hp-h2">Start dispatching in 5&nbsp;minutes</h2>
        <p className="hp-body">
          Free forever up to 100 orders/month. No credit card. Up and running today.
        </p>
        <div className="final-cta-buttons">
          <Link to="/register" className="btn-primary">Get started free &rarr;</Link>
          <Link to="/demo" className="btn-outline">Try the demo</Link>
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Footer ---- */

function Footer() {
  return (
    <footer className="hp-footer">
      <span className="hp-footer-logo">HOMER.</span>
      <ul className="hp-footer-links">
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><Link to="/login">Log in</Link></li>
      </ul>
      <span>&copy; 2026 HOMER.io</span>
    </footer>
  );
}

/* ---- Main page export ---- */

export function HomePage() {
  return (
    <div className="hp">
      <Nav />
      <Hero />
      <ProofStrip />
      <NLOpsSection />
      <LearningSection />
      <FeaturesSection />
      <PricingSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}
