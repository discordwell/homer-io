import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../components/landing-v2/home.css';

/* ---- Scroll reveal (same as landing) ---- */

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

/* ---- Nav (reused from landing) ---- */

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
        <li><Link to="/#features">Features</Link></li>
        <li><Link to="/pricing">Pricing</Link></li>
        <li><Link to="/login">Log in</Link></li>
      </ul>
      <Link to="/register" className="hp-nav-cta">Start free</Link>
    </nav>
  );
}

/* ---- Footer ---- */

function Footer() {
  return (
    <footer className="hp-footer">
      <span className="hp-footer-logo">HOMER.</span>
      <ul className="hp-footer-links">
        <li><Link to="/#features">Features</Link></li>
        <li><Link to="/pricing">Pricing</Link></li>
        <li><Link to="/login">Log in</Link></li>
      </ul>
      <span>&copy; 2026 HOMER.io</span>
    </footer>
  );
}

/* ---- Plans data ---- */

interface Plan {
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  orders: string;
  cta: string;
  ctaLink: string;
  primary: boolean;
  popular: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    orders: '100 orders/mo',
    cta: 'Start free',
    ctaLink: '/register',
    primary: false,
    popular: false,
    features: [
      'Unlimited drivers',
      'All features included',
      'Route optimization',
      'Real-time tracking',
      'Proof of delivery',
      'Customer notifications',
      'Analytics dashboard',
    ],
  },
  {
    name: 'Standard',
    monthlyPrice: 149,
    annualPrice: 119,
    orders: '1,000 orders/mo',
    cta: 'Start trial',
    ctaLink: '/register',
    primary: false,
    popular: false,
    features: [
      'Unlimited drivers',
      'All features included',
      'Route optimization',
      'Real-time tracking',
      'Proof of delivery',
      'Customer notifications',
      'Analytics dashboard',
      'API access',
      'Webhook integrations',
    ],
  },
  {
    name: 'Growth',
    monthlyPrice: 349,
    annualPrice: 279,
    orders: '5,000 orders/mo',
    cta: 'Start trial',
    ctaLink: '/register',
    primary: true,
    popular: true,
    features: [
      'Unlimited drivers',
      'All features included',
      'Route optimization',
      'Real-time tracking',
      'Proof of delivery',
      'Customer notifications',
      'Analytics dashboard',
      'API access',
      'Webhook integrations',
      'Priority support',
    ],
  },
  {
    name: 'Scale',
    monthlyPrice: 699,
    annualPrice: 559,
    orders: '15,000 orders/mo',
    cta: 'Start trial',
    ctaLink: '/register',
    primary: false,
    popular: false,
    features: [
      'Unlimited drivers',
      'All features included',
      'Route optimization',
      'Real-time tracking',
      'Proof of delivery',
      'Customer notifications',
      'Analytics dashboard',
      'API access',
      'Webhook integrations',
      'Priority support',
      'Dedicated account manager',
    ],
  },
];

/* ---- Feature matrix ---- */

const FEATURE_MATRIX = [
  { name: 'Route optimization (OSRM + VRP)', free: true, standard: true, growth: true, scale: true },
  { name: 'Real-time driver tracking', free: true, standard: true, growth: true, scale: true },
  { name: 'Driver mobile app', free: true, standard: true, growth: true, scale: true },
  { name: 'Proof of delivery (photo + signature)', free: true, standard: true, growth: true, scale: true },
  { name: 'Customer SMS/email notifications', free: true, standard: true, growth: true, scale: true },
  { name: 'Analytics & reporting', free: true, standard: true, growth: true, scale: true },
  { name: 'AI dispatch copilot', free: true, standard: true, growth: true, scale: true },
  { name: 'Address intelligence', free: true, standard: true, growth: true, scale: true },
  { name: 'REST API', free: true, standard: true, growth: true, scale: true },
  { name: 'Webhooks', free: true, standard: true, growth: true, scale: true },
  { name: 'Shopify / WooCommerce integration', free: true, standard: true, growth: true, scale: true },
  { name: 'CSV / bulk import', free: true, standard: true, growth: true, scale: true },
  { name: 'Custom branding (tracking page)', free: true, standard: true, growth: true, scale: true },
  { name: 'Multi-stop routing', free: true, standard: true, growth: true, scale: true },
  { name: 'Geofencing & auto-arrival', free: true, standard: true, growth: true, scale: true },
  { name: 'Industry compliance modules', free: true, standard: true, growth: true, scale: true },
];

/* ---- Metered extras ---- */

const METERED_EXTRAS = [
  { name: 'Route Optimization', price: '$0.05/run', free: '10/mo free' },
  { name: 'Auto-Dispatch', price: '$0.15/batch', free: '5/mo free' },
  { name: 'AI Chat', price: '$0.02/msg', free: '50/mo free' },
  { name: 'SMS Notifications', price: '$0.01/msg', free: '50/mo free' },
  { name: 'Email Notifications', price: 'Free', free: 'Unlimited' },
  { name: 'POD Storage', price: '$0.10/GB', free: '1 GB/mo free' },
];

/* ---- FAQ ---- */

const FAQ_ITEMS = [
  {
    q: 'What counts as an order?',
    a: 'An order is any delivery task created in HOMER \u2014 whether manually, via API, or imported from an integration. Draft orders that are never dispatched don\'t count.',
  },
  {
    q: 'Can I change plans anytime?',
    a: 'Yes. Upgrade instantly, downgrade at the end of your billing cycle. No lock-in, no penalties.',
  },
  {
    q: 'Is there a contract?',
    a: 'No contracts. All plans are month-to-month (or annual if you choose). Cancel anytime.',
  },
  {
    q: 'What happens if I go over my order limit?',
    a: 'We\'ll notify you when you hit 80% and 100%. Overages are billed at $0.10/order. Or upgrade to the next tier for better per-order pricing.',
  },
  {
    q: 'Do you offer annual billing?',
    a: 'Yes \u2014 annual billing saves 20% on every paid plan. You can switch between monthly and annual anytime.',
  },
];

/* ---- Industry notes ---- */

const INDUSTRY_NOTES = [
  { text: 'Florists: 10 drivers for Valentine\'s Day? Pay per delivery, not per driver.', color: 'var(--accent)' },
  { text: 'Pharmacies: HIPAA compliance included at every tier.', color: 'var(--green)' },
  { text: 'Cannabis: Compliance features at no extra cost.', color: 'var(--purple)' },
];

/* ---- Main pricing page ---- */

export function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="hp">
      <Nav />

      {/* Header */}
      <section style={{
        paddingTop: 140, paddingBottom: 80,
        textAlign: 'center',
        background: 'linear-gradient(180deg, #06090F 0%, #0A1018 100%)',
      }}>
        <Reveal>
          <span className="hp-eyebrow">Pricing</span>
          <h1 className="hp-h2" style={{ marginBottom: 16 }}>
            Simple, transparent pricing
          </h1>
          <p className="hp-body" style={{ margin: '0 auto 48px', textAlign: 'center', maxWidth: 480 }}>
            Per-order pricing. Unlimited drivers. All features.
          </p>

          {/* Annual/Monthly toggle */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: 'var(--bg-card)', borderRadius: 10,
            border: '1px solid var(--border)', padding: 4,
          }}>
            <button
              onClick={() => setAnnual(false)}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: !annual ? 'var(--accent)' : 'transparent',
                color: !annual ? '#000' : 'var(--t2)',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: annual ? 'var(--accent)' : 'transparent',
                color: annual ? '#000' : 'var(--t2)',
                border: 'none', cursor: 'pointer',
                fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600,
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              Annual
              <span style={{
                padding: '2px 8px', borderRadius: 20,
                background: annual ? 'rgba(0,0,0,0.2)' : 'rgba(245,158,11,0.15)',
                color: annual ? '#000' : 'var(--accent)',
                fontSize: 11, fontWeight: 700,
                fontFamily: 'var(--fm)',
              }}>
                -20%
              </span>
            </button>
          </div>
        </Reveal>
      </section>

      {/* Plan cards */}
      <section style={{
        padding: '0 48px 80px',
        background: 'linear-gradient(180deg, #0A1018 0%, #06090F 100%)',
      }}>
        <Reveal>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 20, maxWidth: 1100, margin: '0 auto 32px',
          }}>
            {PLANS.map((p) => {
              const price = annual ? p.annualPrice : p.monthlyPrice;
              return (
                <div key={p.name} className={`pricing-card ${p.popular ? 'popular' : ''}`}>
                  {p.popular && <span className="pricing-badge">Most popular</span>}
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-price">
                    ${price}<span className="mo">{price > 0 ? '/mo' : ''}</span>
                  </div>
                  {annual && p.monthlyPrice > 0 && (
                    <div style={{
                      fontSize: 12, color: 'var(--t3)', marginBottom: 4,
                      fontFamily: 'var(--fm)', textDecoration: 'line-through',
                    }}>
                      ${p.monthlyPrice}/mo
                    </div>
                  )}
                  <div className="plan-orders">{p.orders}</div>
                  <ul className="plan-features">
                    {p.features.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <Link to={p.ctaLink} className={`plan-cta ${p.primary ? 'primary' : 'secondary'}`}>
                    {p.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Enterprise card */}
          <div style={{
            maxWidth: 1100, margin: '0 auto 32px',
            background: 'var(--bg-card)', borderRadius: 14,
            border: '1px solid var(--border)',
            padding: '32px 40px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 24,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--fd)', fontSize: 20, fontWeight: 700,
                marginBottom: 4, color: 'var(--t1)',
              }}>Enterprise</div>
              <p style={{ fontSize: 14, color: 'var(--t2)', margin: 0, maxWidth: 500 }}>
                Unlimited orders, custom SLAs, dedicated infrastructure, SSO, and a direct line to engineering.
                For fleets running 15,000+ orders/month.
              </p>
            </div>
            <a
              href="mailto:hello@homer.io"
              style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '12px 28px', borderRadius: 8,
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--t1)',
                fontFamily: 'var(--fb)', fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
                transition: 'border-color 0.2s, color 0.2s',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Contact us
            </a>
          </div>

          <p className="pricing-note">
            {annual ? 'Billed annually.' : 'Billed monthly.'} Need more volume?{' '}
            <a href="mailto:hello@homer.io">Talk to us</a>.
          </p>
        </Reveal>
      </section>

      {/* Feature matrix */}
      <section className="hp-section" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <Reveal>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <span className="hp-eyebrow">All features, every plan</span>
            <h2 className="hp-h2" style={{ fontSize: 'clamp(28px, 3vw, 40px)' }}>
              No feature gates. Just volume.
            </h2>
          </div>

          <div style={{
            maxWidth: 900, margin: '0 auto',
            background: 'var(--bg-card)', borderRadius: 14,
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}>
            {/* Matrix header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
              padding: '14px 24px',
              borderBottom: '1px solid var(--border)',
              fontFamily: 'var(--fm)', fontSize: 11,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--t3)',
            }}>
              <span>Feature</span>
              <span style={{ textAlign: 'center' }}>Free</span>
              <span style={{ textAlign: 'center' }}>Std</span>
              <span style={{ textAlign: 'center' }}>Growth</span>
              <span style={{ textAlign: 'center' }}>Scale</span>
            </div>

            {/* Matrix rows */}
            {FEATURE_MATRIX.map((row, i) => (
              <div key={row.name} style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px 80px',
                padding: '12px 24px',
                borderBottom: i < FEATURE_MATRIX.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 13, color: 'var(--t2)',
                fontFamily: 'var(--fb)',
              }}>
                <span>{row.name}</span>
                {[row.free, row.standard, row.growth, row.scale].map((v, ci) => (
                  <span key={ci} style={{ textAlign: 'center', color: v ? 'var(--green)' : 'var(--t3)' }}>
                    {v ? '\u2713' : '\u2014'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Industry pricing notes */}
      <section style={{ padding: '0 48px 80px', maxWidth: 1320, margin: '0 auto' }}>
        <Reveal>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16, maxWidth: 900, margin: '0 auto',
          }}>
            {INDUSTRY_NOTES.map((note) => (
              <div key={note.text} style={{
                padding: '20px 24px', borderRadius: 12,
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                fontSize: 14, color: 'var(--t2)',
                lineHeight: 1.6,
                borderLeft: `3px solid ${note.color}`,
              }}>
                {note.text}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Metered pricing */}
      <section style={{
        padding: '80px 48px',
        background: 'linear-gradient(180deg, #06090F 0%, #0A1018 50%, #06090F 100%)',
      }}>
        <Reveal>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span className="hp-eyebrow">Metered Features</span>
              <h2 className="hp-h2" style={{ fontSize: 'clamp(28px, 3vw, 40px)' }}>
                Pay-as-you-go extras
              </h2>
              <p className="hp-body" style={{ margin: '0 auto', textAlign: 'center' }}>
                AI and messaging features are billed at cost. Generous free tiers included with every plan.
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
            }}>
              {METERED_EXTRAS.map((item) => (
                <div key={item.name} style={{
                  padding: '24px', borderRadius: 12,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{
                    fontFamily: 'var(--fd)', fontSize: 15, fontWeight: 700,
                    color: 'var(--t1)',
                  }}>
                    {item.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--fm)', fontSize: 22, fontWeight: 700,
                    color: 'var(--accent)',
                    letterSpacing: '-0.02em',
                  }}>
                    {item.price}
                  </div>
                  <div style={{
                    fontFamily: 'var(--fm)', fontSize: 12,
                    color: 'var(--green)',
                    padding: '4px 10px', borderRadius: 6,
                    background: 'rgba(16,185,129,0.1)',
                    alignSelf: 'flex-start',
                  }}>
                    {item.free}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ */}
      <section className="hp-section" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <Reveal>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <span className="hp-eyebrow">FAQ</span>
              <h2 className="hp-h2" style={{ fontSize: 'clamp(28px, 3vw, 40px)' }}>
                Common questions
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx} style={{
                    borderRadius: 12, overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    transition: 'border-color 0.2s',
                  }}>
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      style={{
                        width: '100%', padding: '18px 24px',
                        background: 'none', border: 'none',
                        color: 'var(--t1)', cursor: 'pointer',
                        fontFamily: 'var(--fb)', fontSize: 15, fontWeight: 600,
                        textAlign: 'left',
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{item.q}</span>
                      <svg
                        width="16" height="16" viewBox="0 0 16 16"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        style={{
                          color: 'var(--t3)', flexShrink: 0, marginLeft: 16,
                          transition: 'transform 0.2s ease',
                          transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                        }}
                      >
                        <polyline points="4 6 8 10 12 6" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div style={{
                        padding: '0 24px 18px',
                        fontSize: 14, color: 'var(--t2)',
                        lineHeight: 1.7,
                      }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <div className="final-cta">
        <Reveal>
          <h2 className="hp-h2">Start free today</h2>
          <p className="hp-body" style={{ margin: '0 auto 40px', textAlign: 'center' }}>
            100 orders/month free forever. No credit card required. Up and running in 5 minutes.
          </p>
          <div className="final-cta-buttons">
            <Link to="/register" className="btn-primary">Get started free &rarr;</Link>
            <Link to="/demo" className="btn-outline">Try the demo</Link>
          </div>
        </Reveal>
      </div>

      <Footer />
    </div>
  );
}
