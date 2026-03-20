import { lazy, Suspense, useState, useCallback } from 'react';
import { BayAreaMap } from './BayAreaMap.js';
import { useHeroGeolocation } from './useHeroGeolocation.js';
import './heroMap.css';

const MapLibreHeroMap = lazy(() => import('./MapLibreHeroMap.js'));

export function HeroMap() {
  const { lat, lng, status } = useHeroGeolocation();
  const [mapReady, setMapReady] = useState(false);

  const onReady = useCallback(() => setMapReady(true), []);

  const showMapLibre = status === 'granted' && lat !== null && lng !== null;

  return (
    <div className="hero-map-container">
      {/* SVG fallback — always rendered initially, fades out when MapLibre is ready */}
      <div className={`hero-map-svg ${mapReady ? 'faded' : ''}`}>
        <BayAreaMap />
      </div>

      {/* MapLibre — only loaded if geolocation granted */}
      {showMapLibre && (
        <div className={`hero-map-gl ${mapReady ? 'visible' : ''}`}>
          <Suspense fallback={null}>
            <MapLibreHeroMap lat={lat} lng={lng} onReady={onReady} />
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
