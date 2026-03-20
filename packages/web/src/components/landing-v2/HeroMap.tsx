import { lazy, Suspense, useState, useCallback } from 'react';
import { BayAreaMap } from './BayAreaMap.js';
import { useHeroGeolocation } from './useHeroGeolocation.js';
import './heroMap.css';

const MapLibreHeroMap = lazy(() => import('./MapLibreHeroMap.js'));

// Bay Area default center
const BAY_AREA = { lat: 37.56, lng: -122.15 };

const hasApiKey = !!import.meta.env.VITE_MAPTILER_KEY;

export function HeroMap() {
  const { lat, lng, status } = useHeroGeolocation();
  const [mapReady, setMapReady] = useState(false);

  const onReady = useCallback(() => setMapReady(true), []);

  // Determine map center: user location if granted, Bay Area otherwise
  const settled = status !== 'pending';
  const centerLat = status === 'granted' && lat !== null ? lat : BAY_AREA.lat;
  const centerLng = status === 'granted' && lng !== null ? lng : BAY_AREA.lng;

  return (
    <div className="hero-map-container">
      {/* SVG fallback — shown until MapLibre is ready (or permanently if no API key) */}
      <div className={`hero-map-svg ${mapReady ? 'faded' : ''}`}>
        <BayAreaMap />
      </div>

      {/* MapLibre — loads once geolocation resolves (granted or denied) */}
      {hasApiKey && settled && (
        <div className={`hero-map-gl ${mapReady ? 'visible' : ''}`}>
          <Suspense fallback={null}>
            <MapLibreHeroMap lat={centerLat} lng={centerLng} onReady={onReady} />
          </Suspense>
        </div>
      )}

      {/* CSS grid overlay */}
      <div className="hero-map-grid" />

      {/* SVG range rings */}
      <svg className="hero-map-rings" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <circle cx="50" cy="50" r="15" fill="none" stroke="#F59E0B" strokeWidth="0.08" opacity="0.05" />
        <circle cx="50" cy="50" r="30" fill="none" stroke="#F59E0B" strokeWidth="0.08" opacity="0.035" />
        <circle cx="50" cy="50" r="45" fill="none" stroke="#F59E0B" strokeWidth="0.08" opacity="0.025" />
      </svg>
    </div>
  );
}
