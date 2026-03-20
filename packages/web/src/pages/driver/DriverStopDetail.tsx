import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../stores/driver.js';
import { NavigateButton } from '../../components/driver/NavigateButton.js';
import { PODFlow } from '../../components/driver/PODFlow.js';
import { DeliveryFailureFlow } from '../../components/driver/DeliveryFailureFlow.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { Badge } from '../../components/Badge.js';
import { C, F, alpha } from '../../theme.js';

function formatAddress(addr: { street?: string; city?: string; state?: string; zip?: string } | null): string {
  if (!addr) return 'No address';
  return [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

export function DriverStopDetailPage() {
  const { routeId, orderId } = useParams<{ routeId: string; orderId: string }>();
  const navigate = useNavigate();
  const { currentRoute, fetchCurrentRoute } = useDriverStore();
  const [showPOD, setShowPOD] = useState(false);
  const [showFailure, setShowFailure] = useState(false);

  useEffect(() => {
    if (!currentRoute) fetchCurrentRoute();
  }, [currentRoute, fetchCurrentRoute]);

  if (!currentRoute) return <LoadingSpinner />;

  const stop = currentRoute.orders?.find((o) => o.id === orderId);
  if (!stop) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{
          padding: 16, borderRadius: 10, background: alpha(C.red, 0.08),
          border: `1px solid ${alpha(C.red, 0.19)}`, color: C.red, fontSize: 14,
        }}>
          Stop not found
        </div>
      </div>
    );
  }

  const isCompleted = stop.status === 'delivered' || stop.status === 'failed';
  const address = formatAddress(stop.deliveryAddress as { street?: string; city?: string; state?: string; zip?: string });

  if (showPOD) {
    return (
      <PODFlow
        orderId={stop.id}
        routeId={routeId!}
        recipientName={stop.recipientName}
        onComplete={() => {
          setShowPOD(false);
          navigate('/driver');
        }}
        onCancel={() => setShowPOD(false)}
      />
    );
  }

  if (showFailure) {
    return (
      <DeliveryFailureFlow
        orderId={stop.id}
        routeId={routeId!}
        onComplete={() => {
          setShowFailure(false);
          navigate('/driver');
        }}
        onCancel={() => setShowFailure(false)}
      />
    );
  }

  const statusColors: Record<string, string> = {
    assigned: 'blue', in_transit: 'yellow', delivered: 'green', failed: 'red',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: C.bg2,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/driver')}
          style={{
            background: 'none', border: 'none', color: C.accent,
            cursor: 'pointer', fontSize: 14, fontFamily: F.body,
            minWidth: 44, minHeight: 44,
            display: 'flex', alignItems: 'center',
            padding: 0,
          }}
        >
          <svg width={20} height={20} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            Stop {stop.stopSequence}
          </div>
        </div>
        <Badge color={statusColors[stop.status] || 'dim'}>{stop.status.replace('_', ' ')}</Badge>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Recipient info */}
        <div style={{
          background: C.bg2, borderRadius: 12, padding: 16,
          border: `1px solid ${C.border}`,
        }}>
          <h3 style={{ fontFamily: F.display, fontSize: 18, margin: '0 0 12px', color: C.text }}>
            {stop.recipientName}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Address */}
            <div style={{ display: 'flex', gap: 10 }}>
              <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke={C.dim} strokeWidth={1.5} style={{ flexShrink: 0, marginTop: 1 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span style={{ fontSize: 14, color: C.text }}>{address}</span>
            </div>

            {/* Phone */}
            {stop.recipientPhone && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke={C.dim} strokeWidth={1.5} style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href={`tel:${stop.recipientPhone}`} style={{ fontSize: 14, color: C.accent, textDecoration: 'none' }}>
                  {stop.recipientPhone}
                </a>
              </div>
            )}

            {/* Package count */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <svg width={18} height={18} fill="none" viewBox="0 0 24 24" stroke={C.dim} strokeWidth={1.5} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span style={{ fontSize: 14, color: C.text }}>
                {stop.packageCount} package{stop.packageCount !== 1 ? 's' : ''}
                {stop.weight && <> &middot; {stop.weight} kg</>}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {stop.notes && (
          <div style={{
            background: C.bg2, borderRadius: 12, padding: 16,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Delivery Notes
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              {stop.notes}
            </div>
          </div>
        )}

        {/* Time window */}
        {(stop.timeWindowStart || stop.timeWindowEnd) && (
          <div style={{
            background: C.bg2, borderRadius: 12, padding: 16,
            border: `1px solid ${C.border}`,
          }}>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Time Window
            </div>
            <div style={{ fontSize: 14 }}>
              {stop.timeWindowStart && new Date(stop.timeWindowStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {stop.timeWindowStart && stop.timeWindowEnd && ' — '}
              {stop.timeWindowEnd && new Date(stop.timeWindowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}

        {/* Navigate button */}
        {stop.deliveryLat && stop.deliveryLng && (
          <NavigateButton
            lat={Number(stop.deliveryLat)}
            lng={Number(stop.deliveryLng)}
            address={address}
          />
        )}
      </div>

      {/* Action buttons - only for non-completed stops */}
      {!isCompleted && (
        <div style={{
          padding: 16,
          borderTop: `1px solid ${C.border}`,
          background: C.bg2,
          display: 'flex',
          gap: 10,
        }}>
          <button
            onClick={() => setShowFailure(true)}
            style={{
              flex: 1,
              padding: '14px 16px',
              background: 'transparent',
              border: `1px solid ${C.red}`,
              borderRadius: 10,
              color: C.red,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: F.body,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Failed Delivery
          </button>
          <button
            onClick={() => setShowPOD(true)}
            style={{
              flex: 2,
              padding: '14px 16px',
              background: C.green,
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: F.body,
              cursor: 'pointer',
              minHeight: 44,
            }}
          >
            Complete Delivery
          </button>
        </div>
      )}

      {/* Completed status */}
      {isCompleted && (
        <div style={{
          padding: 16,
          borderTop: `1px solid ${C.border}`,
          background: C.bg2,
          textAlign: 'center',
        }}>
          <div style={{
            padding: 14, borderRadius: 10,
            background: stop.status === 'delivered' ? alpha(C.green, 0.08) : alpha(C.red, 0.08),
            border: `1px solid ${stop.status === 'delivered' ? alpha(C.green, 0.19) : alpha(C.red, 0.19)}`,
            color: stop.status === 'delivered' ? C.green : C.red,
            fontSize: 14, fontWeight: 600,
          }}>
            {stop.status === 'delivered' ? 'Delivered' : 'Failed'}
            {stop.completedAt && (
              <span style={{ fontWeight: 400, fontSize: 12, display: 'block', marginTop: 4 }}>
                {new Date(stop.completedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
