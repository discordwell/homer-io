import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { C, F, alpha } from '../theme.js';
import { StatusTimeline } from '../components/tracking/StatusTimeline.js';
import { TrackingMap } from '../components/tracking/TrackingMap.js';

interface TrackingData {
  orderId: string;
  status: string;
  recipientName: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  estimatedDelivery: string | null;
  driverLocation: { lat: number; lng: number } | null;
  timeline: Array<{ action: string; createdAt: string; metadata?: Record<string, unknown> }>;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  received: 'Received',
  assigned: 'Assigned',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  failed: 'Failed',
  returned: 'Returned',
};

const STATUS_COLORS: Record<string, string> = {
  received: C.dim,
  assigned: C.yellow,
  in_transit: C.accent,
  delivered: C.green,
  failed: C.red,
  returned: C.orange,
};

function formatETA(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `Today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PublicTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;

    const apiBase = import.meta.env.VITE_API_URL || '/api';

    fetch(`${apiBase}/public/track/${orderId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(body.message || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [orderId]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: F.body,
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `linear-gradient(135deg, ${C.accent}, ${C.purple})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          H
        </div>
        <div>
          <div style={{ fontFamily: F.display, fontWeight: 700, fontSize: 18 }}>
            HOMER.io
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>Shipment Tracking</div>
        </div>
      </header>

      {/* Content */}
      <main
        className="tracking-main"
        style={{
          maxWidth: 560,
          margin: '0 auto',
          padding: '32px 20px',
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: `3px solid ${C.muted}`,
                borderTopColor: C.accent,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <div style={{ color: C.dim }}>Loading tracking info...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {error && (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>?</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Shipment Not Found
            </div>
            <div style={{ color: C.dim, fontSize: 14 }}>
              {error === 'Order not found'
                ? 'We couldn\'t find a shipment with that tracking ID. Please check the link and try again.'
                : error}
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Order Info Card */}
            <div
              style={{
                background: C.bg2,
                borderRadius: 12,
                padding: '24px',
                border: `1px solid ${C.border}`,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 20,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: C.dim, marginBottom: 4 }}>
                    Shipment for
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>
                    {data.recipientName}
                  </div>
                </div>
                <div
                  style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    background: `${STATUS_COLORS[data.status] || C.dim}22`,
                    color: STATUS_COLORS[data.status] || C.dim,
                    border: `1px solid ${STATUS_COLORS[data.status] || C.dim}44`,
                  }}
                >
                  {STATUS_LABELS[data.status] || data.status}
                </div>
              </div>

              {/* ETA */}
              {data.estimatedDelivery && data.status !== 'delivered' && data.status !== 'failed' && (
                <div
                  style={{
                    background: C.bg3,
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 13, color: C.dim }}>Estimated Delivery</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>
                    {formatETA(data.estimatedDelivery)}
                  </span>
                </div>
              )}

              {data.status === 'delivered' && data.completedAt && (
                <div
                  style={{
                    background: alpha(C.green, 0.07),
                    borderRadius: 8,
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    border: `1px solid ${alpha(C.green, 0.20)}`,
                  }}
                >
                  <span style={{ fontSize: 13, color: C.dim }}>Delivered</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.green }}>
                    {formatETA(data.completedAt)}
                  </span>
                </div>
              )}

              {/* Tracking ID */}
              <div
                style={{
                  marginTop: 16,
                  fontSize: 11,
                  color: C.dim,
                  fontFamily: F.mono,
                }}
              >
                Tracking ID: {data.orderId}
              </div>
            </div>

            {/* Map — only show if in_transit and driver location is available */}
            {data.status === 'in_transit' && data.driverLocation && (
              <div style={{ marginBottom: 24 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: C.green,
                      animation: 'pulse 2s ease-in-out infinite',
                    }}
                  />
                  Live Tracking
                </div>
                <TrackingMap
                  driverLat={data.driverLocation.lat}
                  driverLng={data.driverLocation.lng}
                  destLat={data.deliveryLat ?? undefined}
                  destLng={data.deliveryLng ?? undefined}
                />
              </div>
            )}

            {/* Timeline */}
            <div
              style={{
                background: C.bg2,
                borderRadius: 12,
                padding: '24px',
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  marginBottom: 16,
                }}
              >
                Shipment Journey
              </div>
              <StatusTimeline
                currentStatus={data.status}
                events={data.timeline}
              />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          color: C.dim,
          fontSize: 12,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        Powered by HOMER.io
      </footer>
    </div>
  );
}
