import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverStore } from '../../stores/driver.js';
import { StopCard } from '../../components/driver/StopCard.js';
import { DriverChat } from '../../components/driver/DriverChat.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { EmptyState } from '../../components/EmptyState.js';
import { C, F } from '../../theme.js';

function formatAddress(addr: { street?: string; city?: string; state?: string; zip?: string } | null): string {
  if (!addr) return 'No address';
  return [addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ');
}

export function DriverRoutePage() {
  const navigate = useNavigate();
  const { currentRoute, upcomingRoutes, loading, error, fetchCurrentRoute, fetchUpcomingRoutes } = useDriverStore();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    fetchCurrentRoute();
    fetchUpcomingRoutes();
  }, [fetchCurrentRoute, fetchUpcomingRoutes]);

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{
          padding: 16, borderRadius: 10, background: `${C.red}15`,
          border: `1px solid ${C.red}30`, color: C.red, fontSize: 14,
        }}>
          {error}
        </div>
      </div>
    );
  }

  if (!currentRoute) {
    return (
      <div style={{ padding: 16 }}>
        <EmptyState
          icon="Route"
          title="No Active Route"
          description="You don't have an active route right now. Check back when a dispatcher assigns one."
        />

        {upcomingRoutes.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontFamily: F.display, fontSize: 16, marginBottom: 12, color: C.text }}>
              Upcoming Routes
            </h3>
            {upcomingRoutes.map((route) => (
              <div key={route.id} style={{
                padding: 14, background: C.bg2, borderRadius: 10,
                border: `1px solid ${C.border}`, marginBottom: 8,
              }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                  {route.name}
                </div>
                <div style={{ fontSize: 12, color: C.dim }}>
                  {route.totalStops} stop{route.totalStops !== 1 ? 's' : ''}
                  {route.plannedStartAt && (
                    <> &middot; {new Date(route.plannedStartAt).toLocaleString()}</>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const stops = currentRoute.orders || [];
  const firstNonCompleted = stops.findIndex(
    (s) => s.status !== 'delivered' && s.status !== 'failed',
  );

  const progress = currentRoute.totalStops > 0
    ? (currentRoute.completedStops / currentRoute.totalStops) * 100
    : 0;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Route header */}
      <div style={{
        background: C.bg2,
        borderRadius: 12,
        padding: 16,
        border: `1px solid ${C.border}`,
      }}>
        <h2 style={{
          fontFamily: F.display, fontSize: 18, margin: '0 0 8px',
          color: C.text,
        }}>
          {currentRoute.name}
        </h2>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>
          {currentRoute.completedStops} of {currentRoute.totalStops} stops completed
        </div>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: 6,
          background: C.muted,
          borderRadius: 3,
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: progress === 100 ? C.green : C.accent,
            borderRadius: 3,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>

      {/* Stop list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stops.map((stop, i) => (
          <StopCard
            key={stop.id}
            recipientName={stop.recipientName}
            address={formatAddress(stop.deliveryAddress as { street?: string; city?: string; state?: string; zip?: string })}
            status={stop.status}
            packageCount={stop.packageCount}
            stopSequence={stop.stopSequence}
            isNextStop={i === firstNonCompleted}
            onClick={() => navigate(`/driver/stop/${currentRoute.id}/${stop.id}`)}
          />
        ))}
      </div>

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen(true)}
        style={{
          position: 'fixed', bottom: 20, right: 20,
          width: 52, height: 52, borderRadius: 26,
          background: C.accent, border: 'none',
          color: '#fff', fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(91,164,245,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}
        title="Open chat"
      >
        &#9993;
      </button>

      {/* Chat panel */}
      {chatOpen && <DriverChat onClose={() => setChatOpen(false)} />}
    </div>
  );
}
