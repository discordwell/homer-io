import { useEffect } from 'react';
import { C, F } from '../theme.js';
import { useSocket } from '../hooks/useSocket.js';
import { useTrackingStore } from '../stores/tracking.js';
import { LiveFleetMap } from '../components/LiveFleetMap.js';
import { DeliveryEventFeed } from '../components/DeliveryEventFeed.js';

export default function LiveMap() {
  const socket = useSocket();
  const driverLocations = useTrackingStore((s) => s.driverLocations);
  const fetchDriverLocations = useTrackingStore((s) => s.fetchDriverLocations);
  const subscribeToUpdates = useTrackingStore((s) => s.subscribeToUpdates);
  const unsubscribe = useTrackingStore((s) => s.unsubscribe);
  const loading = useTrackingStore((s) => s.loading);

  // Fetch initial driver locations on mount
  useEffect(() => {
    fetchDriverLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to real-time updates when socket connects
  useEffect(() => {
    if (!socket) return;

    subscribeToUpdates(socket);

    return () => {
      unsubscribe(socket);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  const driverCount = driverLocations.size;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1
            style={{
              fontFamily: F.display,
              fontSize: 22,
              fontWeight: 700,
              color: C.text,
              margin: 0,
            }}
          >
            Live Fleet View
          </h1>
          <span
            style={{
              backgroundColor: C.accent,
              color: C.bg,
              fontSize: 12,
              fontFamily: F.mono,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 12,
            }}
          >
            {loading ? '...' : `${driverCount} driver${driverCount !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div
          style={{
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
              backgroundColor: socket ? C.green : C.red,
            }}
          />
          <span
            style={{
              fontFamily: F.body,
              fontSize: 12,
              color: C.dim,
            }}
          >
            {socket ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main content: map + event feed side by side */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 16,
          padding: '0 24px 24px',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Map - 70% width */}
        <div style={{ flex: 7, minWidth: 0 }}>
          <LiveFleetMap height="100%" />
        </div>

        {/* Event feed - 30% width */}
        <div style={{ flex: 3, minWidth: 240 }}>
          <DeliveryEventFeed />
        </div>
      </div>
    </div>
  );
}
