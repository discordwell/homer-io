import { useState, useEffect, type ReactNode, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { VerticalContent } from './vertical-content.js';
import './home.css';

/* ================================================================
   VerticalLanding — industry-specific conversion page
   Uses the same design language and CSS from home.css (the .hp class)
   with inline styles for vertical-specific elements.
   ================================================================ */

/* ---- Scroll reveal (same as HomePage) ---- */

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`reveal visible ${className}`}>{children}</div>;
}

/* ---- Nav ---- */

function VerticalNav({ industry }: { industry: string }) {
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
        <li><a href="#compare">Compare</a></li>
        <li><Link to="/login">Log in</Link></li>
      </ul>
      <Link to={`/register?industry=${industry.toLowerCase()}`} className="hp-nav-cta">
        Start free
      </Link>
    </nav>
  );
}

/* ---- Hero ---- */

function VerticalHero({ content }: { content: VerticalContent }) {
  const featurePreview = content.features.slice(0, 4);

  return (
    <section className="hero" style={{ minHeight: '92vh' }}>
      {/* Background: dark gradient instead of map */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 70% 40%, rgba(245,158,11,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 60% 80% at 20% 80%, rgba(16,185,129,0.03) 0%, transparent 60%),
          linear-gradient(180deg, #06090F 0%, #0A1220 50%, #06090F 100%)
        `,
      }} />

      {/* Subtle grid pattern overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        opacity: 0.03,
        backgroundImage: `
          linear-gradient(rgba(241,245,249,1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(241,245,249,1) 1px, transparent 1px)
        `,
        backgroundSize: '64px 64px',
      }} />

      <div className="hero-content" style={{
        position: 'relative',
        zIndex: 2,
        width: '100%',
        maxWidth: 1320,
        margin: '0 auto',
        padding: '140px 48px 80px',
        display: 'flex',
        alignItems: 'center',
        gap: 64,
      }}>
        {/* Left: text */}
        <div style={{ flex: 1, maxWidth: 620 }}>
          <span className="hero-eyebrow">{content.industry} Delivery</span>
          <h1 className="hero-h1" style={{ fontSize: 'clamp(40px, 5vw, 68px)' }}>
            {content.hero.headline}
          </h1>
          <p className="hero-sub" style={{ maxWidth: 540 }}>
            {content.hero.subheadline}
          </p>
          <div className="hero-buttons">
            <Link to={`/register?industry=${content.slug}`} className="btn-primary">
              {content.hero.ctaText} &rarr;
            </Link>
            <Link to="/demo" className="btn-outline">See how it works</Link>
          </div>
        </div>

        {/* Right: feature preview card */}
        <div style={{
          width: 440,
          maxWidth: '100%',
          flexShrink: 0,
          background: 'rgba(12,18,32,0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid var(--border2)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 32px 64px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 24px',
            borderBottom: '1px solid var(--border2)',
            fontFamily: 'var(--fm)',
            fontSize: 13,
            color: 'var(--t3)',
            letterSpacing: '0.5px',
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--green)',
              animation: 'dot-pulse 2s ease-in-out infinite',
            }} />
            <span>Built for {content.industry.toLowerCase()} delivery</span>
          </div>
          <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {featurePreview.map((f) => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <span style={{
                  fontSize: 22,
                  width: 42,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--accent-bg)',
                  borderRadius: 10,
                  flexShrink: 0,
                }}>
                  {f.icon}
                </span>
                <div>
                  <div style={{
                    fontFamily: 'var(--fd)',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--t1)',
                    marginBottom: 4,
                  }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: 13.5, color: 'var(--t3)', lineHeight: 1.55 }}>
                    {f.description.slice(0, 120)}{f.description.length > 120 ? '\u2026' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hero-scroll">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </section>
  );
}

/* ---- Pain Points ---- */

const painCardStyle: CSSProperties = {
  padding: '28px 24px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border2)',
  borderRadius: 14,
  borderLeft: '3px solid var(--red)',
  transition: 'border-color 0.25s, transform 0.15s',
};

function PainPointsSection({ content }: { content: VerticalContent }) {
  return (
    <div className="hp-section" style={{ borderTop: '1px solid var(--border2)' }}>
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span className="hp-eyebrow">Sound familiar?</span>
          <h2 className="hp-h2">Where {content.industry.toLowerCase()} delivery breaks down</h2>
        </div>
      </Reveal>
      <Reveal>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {content.painPoints.map((p) => (
            <div key={p.title} style={painCardStyle}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.borderLeftColor = 'var(--red)';
              }}
            >
              <h3 style={{
                fontFamily: 'var(--fd)',
                fontSize: 17,
                fontWeight: 700,
                marginBottom: 10,
                letterSpacing: '-0.01em',
                color: 'var(--t1)',
              }}>
                {p.title}
              </h3>
              <p style={{
                fontSize: 14,
                color: 'var(--t2)',
                lineHeight: 1.65,
              }}>
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Features ---- */

function FeaturesSection({ content }: { content: VerticalContent }) {
  return (
    <div className="hp-section" id="features">
      <Reveal>
        <div className="features-heading">
          <span className="hp-eyebrow">Capabilities</span>
          <h2 className="hp-h2">Built for {content.industry.toLowerCase()} delivery</h2>
        </div>
      </Reveal>
      <Reveal>
        <div className="feature-grid">
          {content.features.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-card-icon">
                <span style={{ fontSize: 20 }}>{f.icon}</span>
              </div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Competitor Comparison ---- */

const cellBase: CSSProperties = {
  padding: '16px 20px',
  fontSize: 14,
  lineHeight: 1.5,
  borderBottom: '1px solid var(--border2)',
  color: 'var(--t2)',
};

function CompetitorSection({ content }: { content: VerticalContent }) {
  return (
    <div className="hp-section" id="compare" style={{ paddingTop: 80 }}>
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="hp-eyebrow">Compare</span>
          <h2 className="hp-h2">Why {content.industry.toLowerCase()} businesses switch to HOMER</h2>
        </div>
      </Reveal>
      <Reveal>
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          background: 'var(--bg-card)',
          border: '1px solid var(--border2)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr 1.3fr',
            borderBottom: '1px solid var(--border2)',
          }}>
            <div style={{
              ...cellBase,
              fontFamily: 'var(--fm)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'var(--t3)',
              borderBottom: '1px solid var(--border2)',
            }}>
              Competitor
            </div>
            <div style={{
              ...cellBase,
              fontFamily: 'var(--fm)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'var(--t3)',
              borderBottom: '1px solid var(--border2)',
            }}>
              Their Approach
            </div>
            <div style={{
              ...cellBase,
              fontFamily: 'var(--fm)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'var(--accent)',
              borderBottom: '1px solid var(--border2)',
            }}>
              HOMER
            </div>
          </div>

          {/* Table rows */}
          {content.competitors.map((c, i) => (
            <div key={c.name} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.3fr 1.3fr',
              borderBottom: i < content.competitors.length - 1 ? '1px solid var(--border2)' : 'none',
            }}>
              <div style={{ ...cellBase, fontWeight: 600, color: 'var(--t1)', borderBottom: 'none' }}>
                {c.name}
              </div>
              <div style={{ ...cellBase, color: 'var(--t3)', borderBottom: 'none' }}>
                {c.price}
              </div>
              <div style={{ ...cellBase, color: 'var(--green)', fontWeight: 500, borderBottom: 'none' }}>
                {c.homer}
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Compliance ---- */

function ComplianceSection({ content }: { content: VerticalContent }) {
  if (!content.compliance?.length) return null;

  return (
    <div className="hp-section" style={{ paddingTop: 80 }}>
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span className="hp-eyebrow">Compliance</span>
          <h2 className="hp-h2">Regulated industry? We&apos;ve got you.</h2>
        </div>
      </Reveal>
      <Reveal>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
          maxWidth: 900,
          margin: '0 auto',
        }}>
          {content.compliance.map((c) => (
            <div key={c.title} style={{
              padding: '28px 24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border2)',
              borderRadius: 14,
              borderTop: '3px solid var(--green)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
              }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--green)' }}>
                  <path d="M2 8.5L6 12.5L14 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <h3 style={{
                  fontFamily: 'var(--fd)',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--t1)',
                  letterSpacing: '-0.01em',
                }}>
                  {c.title}
                </h3>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--t2)', lineHeight: 1.6 }}>
                {c.description}
              </p>
            </div>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ---- Pricing (reused from HomePage structure) ---- */

function PricingSection({ content }: { content: VerticalContent }) {
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
            <h2 className="hp-h2">Pricing for {content.industry.toLowerCase()} peaks, not seat counts</h2>
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
                <Link
                  to={`/register?industry=${content.slug}`}
                  className={`plan-cta ${p.primary ? 'primary' : 'secondary'}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          {/* Industry-specific pricing note */}
          <div style={{
            textAlign: 'center',
            marginTop: 8,
            padding: '16px 24px',
            background: 'var(--accent-bg)',
            borderRadius: 10,
            maxWidth: 600,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            <p style={{
              fontFamily: 'var(--fb)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--accent)',
              lineHeight: 1.5,
              margin: 0,
            }}>
              {content.pricingNote}
            </p>
          </div>
          <p className="pricing-note" style={{ marginTop: 20 }}>
            Annual billing saves 20%. Need more volume?{' '}
            <a href="mailto:hello@homer.io">Talk to us</a>.
          </p>
        </Reveal>
      </div>
    </div>
  );
}

/* ---- Final CTA ---- */

function FinalCTA({ content }: { content: VerticalContent }) {
  return (
    <div className="final-cta">
      <Reveal>
        <h2 className="hp-h2">Launch {content.industry.toLowerCase()} delivery this week</h2>
        <p className="hp-body">
          Free forever up to 100 orders/month. No credit card. Up and running today.
        </p>
        <div className="final-cta-buttons">
          <Link to={`/register?industry=${content.slug}`} className="btn-primary">
            {content.hero.ctaText} &rarr;
          </Link>
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
        <li><Link to="/">Home</Link></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#pricing">Pricing</a></li>
        <li><Link to="/login">Log in</Link></li>
      </ul>
      <span>&copy; 2026 HOMER.io</span>
    </footer>
  );
}

/* ---- Main export ---- */

export function VerticalLanding({ content }: { content: VerticalContent }) {
  // Scroll to top on mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // SEO: set document title and meta description from vertical content
  useEffect(() => {
    document.title = `${content.hero.headline} | HOMER`;
    let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.appendChild(meta); }
    meta.content = content.hero.subheadline;
    return () => { document.title = 'HOMER.io — AI-Powered Logistics Platform'; };
  }, [content]);

  return (
    <div className="hp">
      <VerticalNav industry={content.slug} />
      <VerticalHero content={content} />
      <PainPointsSection content={content} />
      <FeaturesSection content={content} />
      <CompetitorSection content={content} />
      <ComplianceSection content={content} />
      <PricingSection content={content} />
      <FinalCTA content={content} />
      <Footer />
    </div>
  );
}
