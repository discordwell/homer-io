import { useEffect } from 'react';
import { useBillingStore } from '../stores/billing.js';
import { C, F } from '../theme.js';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function SubscriptionBanner() {
  const { subscription, loadSubscription, createPortal, createCheckout } = useBillingStore();

  useEffect(() => {
    if (!subscription) {
      loadSubscription();
    }
  }, []);

  if (!subscription) return null;

  const { status, trialEndsAt, ordersUsed, ordersLimit } = subscription;

  // Order limit warning (>= 90%) — ordersLimit of -1 means unlimited
  if (status === 'active' && ordersLimit !== -1) {
    const percent = Math.round((ordersUsed / ordersLimit) * 100);
    if (percent >= 90) {
      return (
        <Banner
          color={percent >= 100 ? C.red : C.orange}
          message={
            percent >= 100
              ? `You've reached your monthly order limit (${ordersUsed.toLocaleString()}/${ordersLimit.toLocaleString()}). Upgrade to continue creating orders.`
              : `You're at ${percent}% of your monthly order limit (${ordersUsed.toLocaleString()}/${ordersLimit.toLocaleString()}).`
          }
          linkText="Upgrade Plan"
          onLink={() => {
            window.location.hash = '';
            window.location.href = '/dashboard/settings?tab=billing';
          }}
        />
      );
    }
  }

  // Trial expiring (less than 3 days)
  if (status === 'trialing') {
    const days = daysUntil(trialEndsAt);
    if (days === null || days > 3) return null;

    return (
      <Banner
        color={C.yellow}
        message={
          days === 0
            ? 'Your trial expires today. Add a payment method to continue.'
            : `Your trial expires in ${days} day${days !== 1 ? 's' : ''}. Add a payment method to continue.`
        }
        linkText="Add Payment"
        onLink={async () => {
          const url = await createCheckout('standard', 'monthly');
          window.location.href = url;
        }}
      />
    );
  }

  // Past due
  if (status === 'past_due') {
    return (
      <Banner
        color={C.orange}
        message="Your payment is past due. Please update your payment method to avoid service interruption."
        linkText="Update Payment"
        onLink={async () => {
          const url = await createPortal();
          window.location.href = url;
        }}
      />
    );
  }

  // Canceled or unpaid
  if (status === 'canceled' || status === 'unpaid') {
    return (
      <Banner
        color={C.red}
        message={
          status === 'canceled'
            ? 'Your subscription has been canceled. Resubscribe to restore full access.'
            : 'Your payment has failed. Please update your billing information.'
        }
        linkText="Resubscribe"
        onLink={async () => {
          const url = await createCheckout('standard', 'monthly');
          window.location.href = url;
        }}
      />
    );
  }

  // Active — no banner
  return null;
}

function Banner({
  color,
  message,
  linkText,
  onLink,
}: {
  color: string;
  message: string;
  linkText: string;
  onLink: () => void;
}) {
  return (
    <div style={{
      background: `${color}15`,
      border: `1px solid ${color}40`,
      borderRadius: 8,
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    }}>
      <span style={{
        color,
        fontSize: 13,
        fontFamily: F.body,
        fontWeight: 500,
      }}>
        {message}
      </span>
      <button
        onClick={onLink}
        style={{
          background: color,
          border: 'none',
          color: C.bg,
          padding: '6px 16px',
          borderRadius: 6,
          fontFamily: F.body,
          fontWeight: 600,
          fontSize: 13,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          marginLeft: 16,
        }}
      >
        {linkText}
      </button>
    </div>
  );
}
