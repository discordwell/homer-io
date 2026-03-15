import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDriverStore } from '../../stores/driver.js';
import { useGeoLocation } from '../../hooks/useGeoLocation.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.js';
import { C } from '../../theme.js';

export function DriverMapPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.CircleMarker | null>(null);
  const { currentRoute, loading, fetchCurrentRoute } = useDriverStore();
  const geo = useGeoLocation();

  useEffect(() => {
    if (!currentRoute) fetchCurrentRoute();
  }, [currentRoute, fetchCurrentRoute]);

  // Initialize the map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const defaultCenter: [number, number] = geo?.lat && geo?.lng
      ? [geo.lat, geo.lng]
      : [40.7128, -74.006];

    const map = L.map(containerRef.current, { zoomControl: false }).setView(defaultCenter, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    // Add zoom control on the right side
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update driver position marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geo?.lat || !geo?.lng) return;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLatLng([geo.lat, geo.lng]);
    } else {
      driverMarkerRef.current = L.circleMarker([geo.lat, geo.lng], {
        radius: 10,
        fillColor: C.accent,
        fillOpacity: 1,
        color: '#fff',
        weight: 3,
      }).addTo(map);
      driverMarkerRef.current.bindTooltip('You', { permanent: true, direction: 'top', offset: [0, -12] });
    }
  }, [geo?.lat, geo?.lng]);

  // Draw stops and route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentRoute?.orders) return;

    // Clear existing stop markers and polylines (but keep the driver marker)
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker && layer !== driverMarkerRef.current) {
        map.removeLayer(layer);
      }
      if (layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const stops = currentRoute.orders.filter((o) => o.deliveryLat && o.deliveryLng);
    if (stops.length === 0) return;

    const latLngs: [number, number][] = [];

    stops.forEach((stop) => {
      const lat = Number(stop.deliveryLat);
      const lng = Number(stop.deliveryLng);
      latLngs.push([lat, lng]);

      const isCompleted = stop.status === 'delivered' || stop.status === 'failed';
      const fillColor = isCompleted
        ? (stop.status === 'delivered' ? C.green : C.red)
        : C.yellow;

      // Use a DivIcon for numbered markers
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width: 26px; height: 26px; border-radius: 50%;
          background: ${fillColor}; color: #000;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700;
          border: 2px solid #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${stop.stopSequence ?? '?'}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      L.marker([lat, lng], { icon })
        .addTo(map)
        .bindTooltip(stop.recipientName, { direction: 'top', offset: [0, -14] });
    });

    // Draw route line
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: C.accent,
        weight: 3,
        opacity: 0.7,
        dashArray: '8, 8',
      }).addTo(map);
    }

    // Fit bounds to include all stops and driver
    const allPoints = [...latLngs];
    if (geo?.lat && geo?.lng) {
      allPoints.push([geo.lat, geo.lng]);
    }
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [currentRoute?.orders]);

  if (loading && !currentRoute) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 64px)' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* GPS status overlay */}
      {geo?.error && (
        <div style={{
          position: 'absolute', top: 12, left: 12, right: 12,
          padding: '10px 14px', borderRadius: 8,
          background: `${C.yellow}20`, border: `1px solid ${C.yellow}40`,
          color: C.yellow, fontSize: 12, zIndex: 500,
        }}>
          GPS: {geo.error}
        </div>
      )}

      {/* Route info overlay */}
      {currentRoute && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12,
          padding: '12px 16px', borderRadius: 10,
          background: C.bg2, border: `1px solid ${C.border}`,
          zIndex: 500,
        }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
            {currentRoute.name}
          </div>
          <div style={{ fontSize: 12, color: C.dim }}>
            {currentRoute.completedStops}/{currentRoute.totalStops} stops completed
          </div>
        </div>
      )}

      {!currentRoute && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, right: 12,
          padding: '12px 16px', borderRadius: 10,
          background: C.bg2, border: `1px solid ${C.border}`,
          zIndex: 500, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: C.dim }}>
            No active route
          </div>
        </div>
      )}
    </div>
  );
}
