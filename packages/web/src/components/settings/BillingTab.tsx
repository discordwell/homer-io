import { useEffect, useState } from 'react';
import { useBillingStore } from '../../stores/billing.js';
import { PlanSelector } from './PlanSelector.js';
import { LoadingSpinner } from '../LoadingSpinner.js';
import { C, F, alpha } from '../../theme.js';

function formatCents(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const statusColors: Record<string, string> = {
  trialing: C.accent,
  active: C.green,
  past_due: C.orange,
  canceled: C.red,
  unpaid: C.red,
};

const statusLabels: Record<string, string> = {
  trialing: 'Trial',
  active: 'Active',
  past_due: 'Past Due',
  canceled: 'Canceled',
  unpaid: 'Unpaid',
};

const meteredLabels: Record<string, string> = {
  aiOptimizations: 'AI Optimizations',
  aiDispatches: 'AI Auto-Dispatch',
  aiChatMessages: 'AI Chat Messages',
  smsSent: 'SMS Sent',
  emailsSent: 'Emails Sent',
  podStorageMb: 'POD Storage (MB)',
};

export function BillingTab() {
  const {
    subscription, invoices, meteredUsage, loading,
    loadSubscription, loadInvoices, loadMeteredUsage,
    createPortal, togglePayAsYouGo,
  } = useBillingStore();
  const [planSelectorOpen, setPlanSelectorOpen] = useState(false);

  useEffect(() => {
    loadSubscription();
    loadInvoices();
    loadMeteredUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !subscription) return <LoadingSpinner />;

  if (!subscription) {
    return (
      <div style={{ color: C.dim, fontSize: 14, padding: 32, textAlign: 'center' }}>
        No subscription found. Contact support.
      </div>
    );
  }

  const trialDays = daysUntil(subscription.trialEndsAt);
  const planName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
  const isUnlimited = subscription.ordersLimit === -1;
  const ordersPercent = isUnlimited
    ? 0
    : Math.min(100, Math.round((subscription.ordersUsed / subscription.ordersLimit) * 100));

  async function handlePortal() {
    const url = await createPortal();
    window.location.href = url;
  }

  async function handleTogglePayAsYouGo() {
    await togglePayAsYouGo(!subscription!.payAsYouGoEnabled);
  }

  return (
    <div>
      {/* Plan Card */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <h3 style={{ fontFamily: F.display, fontSize: 20, color: C.text, margin: 0 }}>
                {planName} Plan
              </h3>
              <span style={{
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: F.body,
                background: alpha(statusColors[subscription.status] || C.dim, 0.13),
                color: statusColors[subscription.status] || C.dim,
              }}>
                {statusLabels[subscription.status] || subscription.status}
              </span>
            </div>
            {subscription.status === 'trialing' && trialDays !== null && (
              <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
                {trialDays === 0
                  ? 'Trial expires today'
                  : `${trialDays} day${trialDays !== 1 ? 's' : ''} remaining in trial`}
              </p>
            )}
            {subscription.currentPeriodEnd && subscription.status === 'active' && subscription.plan !== 'free' && (
              <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>
                Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPlanSelectorOpen(true)} style={secondaryBtnStyle}>
              Change Plan
            </button>
            {subscription.plan !== 'free' && (
              <button onClick={handlePortal} style={primaryBtnStyle}>
                Manage Payment
              </button>
            )}
          </div>
        </div>

        {/* Order Usage Bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: C.dim, fontSize: 12, fontFamily: F.body, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Orders this month
            </span>
            <span style={{ color: C.text, fontSize: 13, fontFamily: F.body, fontWeight: 600 }}>
              {subscription.ordersUsed.toLocaleString()} / {isUnlimited ? '∞' : subscription.ordersLimit.toLocaleString()}
            </span>
          </div>
          {!isUnlimited && (
            <div style={{ background: C.bg, borderRadius: 4, height: 8, overflow: 'hidden' }}>
              <div style={{
                width: `${ordersPercent}%`,
                height: '100%',
                borderRadius: 4,
                background: ordersPercent >= 90 ? C.red : ordersPercent >= 75 ? C.orange : C.accent,
                transition: 'width 0.3s ease',
              }} />
            </div>
          )}
        </div>

        {/* Usage Summary */}
        <div style={{ display: 'flex', gap: 16 }}>
          <UsageCard label="Orders" value={subscription.ordersUsed} />
          <UsageCard label="Drivers" value={subscription.usage.driverCount} subtitle="Unlimited" />
          <UsageCard label="Routes" value={subscription.usage.routeCount} />
        </div>
      </div>

      {/* Pay-as-you-go + Metered Usage */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: '0 0 4px' }}>
              Pay-as-you-go
            </h3>
            <p style={{ color: C.dim, fontSize: 13, fontFamily: F.body, margin: 0 }}>
              AI, SMS, and storage include a free monthly quota. Enable pay-as-you-go to continue beyond the limit at cost.
            </p>
          </div>
          <button
            onClick={handleTogglePayAsYouGo}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: `1px solid ${subscription.payAsYouGoEnabled ? C.green : C.muted}`,
              background: subscription.payAsYouGoEnabled ? alpha(C.green, 0.08) : 'transparent',
              color: subscription.payAsYouGoEnabled ? C.green : C.dim,
              cursor: 'pointer',
              fontFamily: F.body,
              fontWeight: 600,
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}
          >
            {subscription.payAsYouGoEnabled ? 'Enabled' : 'Enable'}
          </button>
        </div>

        {/* Metered Usage Table */}
        {meteredUsage && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Feature', 'Used', 'Free Quota', 'Overage Cost'].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(meteredUsage.usage).map(([key, used]) => {
                const quota = meteredUsage.quotas[key] ?? 0;
                const overage = meteredUsage.overageCosts[key] ?? 0;
                return (
                  <tr key={key}>
                    <td style={cellStyle}>{meteredLabels[key] || key}</td>
                    <td style={cellStyle}>
                      <span style={{ color: used > quota ? C.orange : C.text, fontWeight: used > quota ? 600 : 400 }}>
                        {used.toLocaleString()}
                      </span>
                    </td>
                    <td style={cellStyle}>{quota.toLocaleString()}</td>
                    <td style={cellStyle}>
                      {overage > 0
                        ? <span style={{ color: C.orange }}>{formatCents(overage)}</span>
                        : <span style={{ color: C.dim }}>—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoice History */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        border: `1px solid ${C.muted}`,
        padding: 24,
      }}>
        <h3 style={{ fontFamily: F.display, fontSize: 18, color: C.text, margin: '0 0 16px' }}>
          Invoice History
        </h3>

        {invoices.length === 0 ? (
          <p style={{ color: C.dim, fontSize: 14 }}>No invoices yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date', 'Amount', 'Status', ''].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={cellStyle}>
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td style={cellStyle}>
                    {formatCents(inv.amountDue, inv.currency)}
                  </td>
                  <td style={cellStyle}>
                    <span style={{
                      color: inv.status === 'paid' ? C.green : inv.status === 'open' ? C.yellow : C.dim,
                      fontWeight: 600,
                      fontSize: 13,
                    }}>
                      {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    {inv.invoicePdf && (
                      <a
                        href={inv.invoicePdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: C.accent, fontSize: 13, textDecoration: 'none', fontFamily: F.body }}
                      >
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Plan Selector Modal */}
      <PlanSelector
        open={planSelectorOpen}
        onClose={() => setPlanSelectorOpen(false)}
        currentPlan={subscription.plan}
      />
    </div>
  );
}

function UsageCard({ label, value, subtitle }: { label: string; value: number; subtitle?: string }) {
  return (
    <div style={{
      flex: 1,
      background: C.bg3,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{ color: C.dim, fontSize: 12, fontFamily: F.body, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 24, color: C.text, fontWeight: 700 }}>
        {value.toLocaleString()}
      </div>
      {subtitle && (
        <div style={{ color: C.dim, fontSize: 12, marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: C.accent,
  border: 'none',
  color: '#000',
  cursor: 'pointer',
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 14,
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: 8,
  background: 'transparent',
  border: `1px solid ${C.muted}`,
  color: C.text,
  cursor: 'pointer',
  fontFamily: F.body,
  fontWeight: 600,
  fontSize: 14,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  color: C.dim,
  fontSize: 12,
  fontFamily: F.body,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: `1px solid ${C.border}`,
};

const cellStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: F.body,
  color: C.text,
  borderBottom: `1px solid ${C.border}`,
};
