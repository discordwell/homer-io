import { lazy, Suspense, useState, useCallback } from 'react';
import { BayAreaMap } from './BayAreaMap.js';
import type { HeroGeoResult } from './useHeroGeolocation.js';
import './heroMap.css';

const MapLibreHeroMap = lazy(() => import('./MapLibreHeroMap.js'));

// Bay Area default center
const BAY_AREA = { lat: 37.56, lng: -122.15 };

const hasApiKey = !!import.meta.env.VITE_MAPTILER_KEY;

function supportsMapWebGL() {
  if (typeof document === 'undefined') return false;

  const canvas = document.createElement('canvas');
  let contextCreationFailed = false;
  const handleContextCreationError = (event: Event) => {
    contextCreationFailed = true;
    if ('preventDefault' in event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
  };

  canvas.addEventListener('webglcontextcreationerror', handleContextCreationError, { once: true });

  try {
    const context =
      canvas.getContext('webgl2')
      || canvas.getContext('webgl')
      || canvas.getContext('experimental-webgl');
    return Boolean(context) && !contextCreationFailed;
  } catch {
    return false;
  } finally {
    canvas.removeEventListener('webglcontextcreationerror', handleContextCreationError);
  }
}

interface HeroMapProps {
  geo: HeroGeoResult;
}

export function HeroMap({ geo }: HeroMapProps) {
  const { lat, lng, status } = geo;
  const [mapReady, setMapReady] = useState(false);
  const [mapEnabled, setMapEnabled] = useState(() => hasApiKey && supportsMapWebGL());

  const onReady = useCallback(() => setMapReady(true), []);
  const onError = useCallback(() => {
    setMapReady(false);
    setMapEnabled(false);
  }, []);

  // mapEnabled is initialised correctly above (line ~47) — no effect needed.

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
      {hasApiKey && settled && mapEnabled && (
        <div className="hero-map-gl">
          <Suspense fallback={null}>
            <MapLibreHeroMap lat={centerLat} lng={centerLng} onReady={onReady} onError={onError} />
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
