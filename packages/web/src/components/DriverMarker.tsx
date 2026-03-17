import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { C } from '../theme.js';
import type { DriverLocation } from '../stores/tracking.js';

interface DriverMarkerProps {
  driver: DriverLocation;
  map: L.Map;
  onClick?: (driver: DriverLocation) => void;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'on_route': return C.green;
    case 'available': return C.accent;
    case 'on_break': return C.yellow;
    default: return C.dim;
  }
}

function createArrowIcon(heading: number | null, color: string): L.DivIcon {
  const rotation = heading ?? 0;
  const arrowSvg = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="${C.bg}" stroke="${color}" stroke-width="2.5" opacity="0.95"/>
      <path d="M16 6 L22 22 L16 18 L10 22 Z" fill="${color}" transform="rotate(${rotation}, 16, 16)" opacity="0.9"/>
    </svg>
  `;

  return L.divIcon({
    html: arrowSvg,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export function DriverMarker({ driver, map, onClick }: DriverMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const color = getStatusColor(driver.driverStatus);
    const icon = createArrowIcon(driver.heading, color);

    if (markerRef.current) {
      // Update existing marker position and icon
      markerRef.current.setLatLng([driver.lat, driver.lng]);
      markerRef.current.setIcon(icon);
    } else {
      // Create new marker
      const marker = L.marker([driver.lat, driver.lng], { icon }).addTo(map);

      marker.bindTooltip(driver.driverName, {
        permanent: false,
        direction: 'top',
        offset: [0, -16],
        className: '',
      });

      if (onClick) {
        marker.on('click', () => onClick(driver));
      }

      const speedText = driver.speed != null ? `${Math.round(driver.speed)} km/h` : 'N/A';
      const updatedText = driver.updatedAt
        ? new Date(driver.updatedAt).toLocaleTimeString()
        : 'Unknown';

      marker.bindPopup(`
        <div style="
          background: ${C.bg2};
          color: ${C.text};
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid ${C.muted};
          font-family: Inter, sans-serif;
          font-size: 13px;
          min-width: 160px;
        ">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 6px;">${driver.driverName}</div>
          <div style="color: ${C.dim}; margin-bottom: 3px;">Status: <span style="color: ${color};">${driver.driverStatus.replace('_', ' ')}</span></div>
          <div style="color: ${C.dim}; margin-bottom: 3px;">Speed: <span style="color: ${C.text};">${speedText}</span></div>
          <div style="color: ${C.dim};">Updated: <span style="color: ${C.text};">${updatedText}</span></div>
        </div>
      `, {
        className: 'driver-popup',
        closeButton: false,
      });

      markerRef.current = marker;
    }
  }, [driver, map, onClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, []);

  return null;
}
