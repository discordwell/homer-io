import { useEffect, useRef, useState } from 'react';
import { C, F } from '../theme.js';
import { useSocket } from '../hooks/useSocket.js';
import { useTrackingStore, type DeliveryEventItem } from '../stores/tracking.js';
import { useAuthStore } from '../stores/auth.js';
import { LiveFleetMap } from '../components/LiveFleetMap.js';
import { DeliveryEventFeed } from '../components/DeliveryEventFeed.js';
import { DEMO_ROUTE_PATHS, advanceAlongPath, type DemoRoutePath } from '../data/demo-route-paths.js';

// Per-driver simulation state
interface SimState {
  pathIndex: number;
  fraction: number;
}

// Distance per tick in degrees (~0.0012° ≈ 133m, gives brisk visual movement)
const DISTANCE_PER_TICK = 0.0012;
// Jitter interval for available drivers (every N ticks)
const JITTER_INTERVAL = 8;

let demoEventCounter = 100;

function seedInitialEvents() {
  const now = new Date();
  const events: DeliveryEventItem[] = [];

  for (const route of DEMO_ROUTE_PATHS) {
    for (const stop of route.stops) {
      if (!stop.completed) continue;

      demoEventCounter++;
      const minutesAgo = Math.floor(Math.random() * 60) + 5;
      const isFailed = stop.orderId === 'demo-010'; // Walnut Creek was a failure

      events.push({
        id: `demo-evt-${demoEventCounter}`,
        routeId: route.routeId,
        routeName: route.routeName,
        orderId: stop.orderId,
        recipientName: stop.recipientName,
        status: isFailed ? 'failed' : 'delivered',
        failureReason: isFailed ? 'Customer not available' : null,
        timestamp: new Date(now.getTime() - minutesAgo * 60000).toISOString(),
      });
    }
  }

  events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const seeded = events.slice(0, 6);

  useTrackingStore.setState((state) => ({
    deliveryEvents: [...seeded, ...state.deliveryEvents].slice(0, 50),
  }));
}

function fireStopEvent(route: DemoRoutePath, stop: DemoRoutePath['stops'][0], isFailed: boolean) {
  demoEventCounter++;
  const event: DeliveryEventItem = {
    id: `demo-evt-${demoEventCounter}`,
    routeId: route.routeId,
    routeName: route.routeName,
    orderId: stop.orderId,
    recipientName: stop.recipientName,
    status: isFailed ? 'failed' : 'delivered',
    failureReason: isFailed ? 'Customer not available' : null,
    timestamp: new Date().toISOString(),
  };

  useTrackingStore.setState((state) => ({
    deliveryEvents: [event, ...state.deliveryEvents].slice(0, 50),
  }));
}

export default function LiveMap() {
  const socket = useSocket();
  const driverLocations = useTrackingStore((s) => s.driverLocations);
  const fetchDriverLocations = useTrackingStore((s) => s.fetchDriverLocations);
  const subscribeToUpdates = useTrackingStore((s) => s.subscribeToUpdates);
  const unsubscribe = useTrackingStore((s) => s.unsubscribe);
  const loading = useTrackingStore((s) => s.loading);
  const isDemo = useAuthStore((s) => s.user?.isDemo);

  // Track driver progress for the map visualization
  const [driverProgress, setDriverProgress] = useState<Map<string, number>>(new Map());

  // Fetch initial driver locations on mount
  useEffect(() => {
    fetchDriverLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to real-time updates when socket connects
  useEffect(() => {
    if (!socket) return;
    subscribeToUpdates(socket);
    return () => { unsubscribe(socket); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Demo mode: route-following simulation
  const simStateRef = useRef<Map<string, SimState>>(new Map());
  const tickRef = useRef(0);
  const seededRef = useRef(false);
  const passedStopsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isDemo) return;

    // Initialize sim state for each route driver
    for (const route of DEMO_ROUTE_PATHS) {
      if (!simStateRef.current.has(route.driverId)) {
        simStateRef.current.set(route.driverId, {
          pathIndex: route.initialPathIndex,
          fraction: 0,
        });
      }
    }

    // Mark already-completed stops as passed so we don't re-fire events
    for (const route of DEMO_ROUTE_PATHS) {
      for (const stop of route.stops) {
        if (stop.completed) {
          passedStopsRef.current.add(`${route.driverId}:${stop.orderId}`);
        }
      }
    }

    // Seed initial delivery events from completed stops
    if (!seededRef.current) {
      seededRef.current = true;
      seedInitialEvents();
    }

    const interval = setInterval(() => {
      tickRef.current++;
      const store = useTrackingStore.getState();
      const updated = new Map(store.driverLocations);
      let changed = false;
      const progressMap = new Map<string, number>();

      // Advance on_route drivers along their paths
      for (const route of DEMO_ROUTE_PATHS) {
        const driver = updated.get(route.driverId);
        if (!driver || driver.driverStatus !== 'on_route') continue;

        const sim = simStateRef.current.get(route.driverId);
        if (!sim) continue;

        const result = advanceAlongPath(
          sim.pathIndex,
          sim.fraction,
          route.path,
          DISTANCE_PER_TICK + (Math.random() - 0.5) * 0.0003,
        );

        sim.pathIndex = result.pathIndex;
        sim.fraction = result.fraction;
        progressMap.set(route.driverId, result.pathIndex);

        updated.set(route.driverId, {
          ...driver,
          lat: result.lat,
          lng: result.lng,
          heading: Math.round(result.heading),
          speed: 25 + Math.random() * 15,
          updatedAt: new Date().toISOString(),
        });
        changed = true;

        // Check if driver passed a stop → fire delivery event
        for (const stop of route.stops) {
          if (stop.completed) continue;
          const key = `${route.driverId}:${stop.orderId}`;
          if (passedStopsRef.current.has(key)) continue;

          if (result.pathIndex >= stop.pathIndex) {
            passedStopsRef.current.add(key);
            fireStopEvent(route, stop, Math.random() < 0.1);
          }
        }

        // If looped, reset non-completed stop tracking for new lap
        if (result.looped) {
          for (const stop of route.stops) {
            if (!stop.completed) {
              passedStopsRef.current.delete(`${route.driverId}:${stop.orderId}`);
            }
          }
        }
      }

      // Available drivers: tiny jitter every JITTER_INTERVAL ticks
      if (tickRef.current % JITTER_INTERVAL === 0) {
        updated.forEach((driver, id) => {
          if (driver.driverStatus !== 'available') return;
          updated.set(id, {
            ...driver,
            lat: driver.lat + (Math.random() - 0.5) * 0.0003,
            lng: driver.lng + (Math.random() - 0.5) * 0.0003,
            updatedAt: new Date().toISOString(),
          });
          changed = true;
        });
      }

      if (changed) {
        useTrackingStore.setState({ driverLocations: updated });
      }
      setDriverProgress(progressMap);
    }, 1000);

    return () => clearInterval(interval);
  }, [isDemo]);

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
              backgroundColor: socket ? C.green : isDemo ? C.accent : C.red,
            }}
          />
          <span
            style={{
              fontFamily: F.body,
              fontSize: 12,
              color: C.dim,
            }}
          >
            {socket ? 'Live' : isDemo ? 'Demo' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Main content: map + event feed side by side */}
      <div
        className="live-map-content"
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
        <div className="live-map-pane" style={{ flex: 7, minWidth: 0 }}>
          <LiveFleetMap height="100%" driverProgress={driverProgress} />
        </div>

        {/* Event feed - 30% width */}
        <div className="live-map-feed" style={{ flex: 3, minWidth: 240 }}>
          <DeliveryEventFeed />
        </div>
      </div>
    </div>
  );
}
