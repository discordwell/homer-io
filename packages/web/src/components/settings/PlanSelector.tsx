import { useState } from 'react';
import { useBillingStore } from '../../stores/billing.js';
import { C, F, alpha } from '../../theme.js';

interface PlanSelectorProps {
  open: boolean;
  onClose: () => void;
  currentPlan: string;
}

interface PlanDef {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  ordersPerMonth: string;
  popular?: boolean;
  features: string[];
}

const plans: PlanDef[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    ordersPerMonth: '100',
    features: [
      '100 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI optimization (10 free/mo)',
      'Email notifications',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    monthlyPrice: 149,
    annualPrice: 119,
    ordersPerMonth: '1,000',
    features: [
      '1,000 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI optimization (10 free/mo)',
      'Email + SMS notifications',
      'E-commerce integrations',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 349,
    annualPrice: 279,
    ordersPerMonth: '5,000',
    popular: true,
    features: [
      '5,000 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI optimization (10 free/mo)',
      'Email + SMS notifications',
      'E-commerce integrations',
      'Priority support',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 699,
    annualPrice: 559,
    ordersPerMonth: '15,000',
    features: [
      '15,000 orders/month',
      'Unlimited drivers',
      'All features included',
      'AI optimization (10 free/mo)',
      'Email + SMS notifications',
      'E-commerce integrations',
      'Priority support',
      'Custom branding',
    ],
  },
];

export function PlanSelector({ open, onClose, currentPlan }: PlanSelectorProps) {
  const { createCheckout, changePlan } = useBillingStore();
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  if (!open) return null;

  async function handleSelect(planId: string) {
    if (planId === currentPlan) return;
    setLoadingPlan(planId);
    try {
      if (planId === 'free') {
        // Downgrade to free
        await changePlan('free', 'monthly');
        onClose();
      } else if (currentPlan === 'free') {
        // Upgrading from free — need checkout
        const url = await createCheckout(planId, interval);
        // eslint-disable-next-line react-hooks/immutability -- legitimate navigation in click-handler context
        window.location.href = url;
      } else {
        // Changing between paid plans — direct change
        await changePlan(planId, interval);
        onClose();
      }
    } catch {
      // Error handled by store
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontFamily: F.display, fontSize: 22, color: C.text, margin: '0 0 4px' }}>
              Choose Your Plan
            </h2>
            <p style={{ color: C.dim, fontSize: 13, fontFamily: F.body, margin: 0 }}>
              All plans include every feature. Unlimited drivers.
            </p>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            &times;
          </button>
        </div>

        {/* Interval Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'flex',
            background: C.bg,
            borderRadius: 8,
            padding: 3,
            border: `1px solid ${C.border}`,
          }}>
            <button
              onClick={() => setInterval('monthly')}
              style={{
                ...toggleBtnStyle,
                background: interval === 'monthly' ? C.accent : 'transparent',
                color: interval === 'monthly' ? '#fff' : C.dim,
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('annual')}
              style={{
                ...toggleBtnStyle,
                background: interval === 'annual' ? C.accent : 'transparent',
                color: interval === 'annual' ? '#fff' : C.dim,
              }}
            >
              Annual
              <span style={{
                marginLeft: 6,
                fontSize: 11,
                background: alpha(C.green, 0.13),
                color: C.green,
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}>
                -20%
              </span>
            </button>
          </div>
        </div>

        {/* Plan Cards */}
        <div style={{ display: 'flex', gap: 12 }}>
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan;
            const price = interval === 'annual' ? plan.annualPrice : plan.monthlyPrice;

            return (
              <div
                key={plan.id}
                style={{
                  flex: 1,
                  background: C.bg3,
                  borderRadius: 12,
                  padding: 20,
                  border: `1px solid ${isCurrent ? C.accent : plan.popular ? C.muted : C.border}`,
                  position: 'relative',
                }}
              >
                {plan.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -10,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: C.accent,
                    color: '#000',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: F.body,
                    padding: '3px 12px',
                    borderRadius: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    Most Popular
                  </div>
                )}

                <h3 style={{ fontFamily: F.display, fontSize: 17, color: C.text, margin: '0 0 4px' }}>
                  {plan.name}
                </h3>
                <div style={{ color: C.dim, fontSize: 12, fontFamily: F.body, marginBottom: 12 }}>
                  {plan.ordersPerMonth} orders/mo
                </div>

                <div style={{ marginBottom: 16 }}>
                  {price === 0 ? (
                    <span style={{ fontFamily: F.display, fontSize: 32, color: C.text, fontWeight: 700 }}>
                      Free
                    </span>
                  ) : (
                    <>
                      <span style={{ fontFamily: F.display, fontSize: 32, color: C.text, fontWeight: 700 }}>
                        ${price}
                      </span>
                      <span style={{ color: C.dim, fontSize: 14 }}>
                        /mo
                      </span>
                    </>
                  )}
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{
                      color: C.text,
                      fontSize: 12,
                      fontFamily: F.body,
                      padding: '4px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={isCurrent || loadingPlan === plan.id}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    borderRadius: 8,
                    border: isCurrent ? `1px solid ${C.muted}` : 'none',
                    background: isCurrent ? 'transparent' : plan.id === 'free' ? C.bg2 : C.accent,
                    color: isCurrent ? C.dim : plan.id === 'free' ? C.text : '#fff',
                    cursor: isCurrent ? 'default' : 'pointer',
                    fontFamily: F.body,
                    fontWeight: 600,
                    fontSize: 13,
                    opacity: loadingPlan === plan.id ? 0.6 : 1,
                  }}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : loadingPlan === plan.id
                      ? 'Processing...'
                      : plan.id === 'free'
                        ? 'Downgrade'
                        : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ color: C.dim, fontSize: 12, fontFamily: F.body, textAlign: 'center', marginTop: 16, marginBottom: 0 }}>
          Need more than 15,000 orders/month? <a href="mailto:sales@homer.io" style={{ color: C.accent }}>Contact us</a> for Enterprise pricing.
        </p>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  background: C.bg2,
  borderRadius: 16,
  padding: 32,
  maxWidth: 900,
  width: '95vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  border: `1px solid ${C.muted}`,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: C.dim,
  fontSize: 24,
  cursor: 'pointer',
  padding: '0 4px',
  lineHeight: 1,
};

const toggleBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 14,
  display: 'flex',
  alignItems: 'center',
};
