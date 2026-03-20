import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildHeroStyle } from './maplibreStyle.js';
import { DriverAnimator } from './driverAnimator.js';

interface MapLibreHeroMapProps {
  lat: number;
  lng: number;
  onReady: () => void;
}

export default function MapLibreHeroMap({ lat, lng, onReady }: MapLibreHeroMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const animatorRef = useRef<DriverAnimator | null>(null);
  const onReadyRef = useRef(onReady);
  const readyFired = useRef(false);
  onReadyRef.current = onReady;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_KEY;
    if (!apiKey) {
      console.warn('[HeroMap] VITE_MAPTILER_KEY not set — staying on SVG fallback');
      return;
    }

    const map = new maplibregl.Map({
      container,
      style: buildHeroStyle(apiKey),
      center: [lng, lat],
      zoom: 10,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    const handleReady = () => {
      if (readyFired.current) return;
      readyFired.current = true;

      const animator = new DriverAnimator(map, container);
      animatorRef.current = animator;
      animator.start();

      onReadyRef.current();
    };

    // 'styledata' fires as soon as the style document is parsed — much earlier
    // than 'load' which waits for every tile/sprite/glyph to finish. This lets
    // us crossfade to the MapLibre canvas while tiles are still streaming in,
    // avoiding the long blank-map gap.
    map.once('styledata', handleReady);
    // Keep 'load' as a belt-and-suspenders fallback in case 'styledata' is
    // somehow skipped (shouldn't happen, but defensive).
    map.on('load', handleReady);
    // Fallback: if neither event fires within 2.5s, show map anyway
    const fallbackTimer = setTimeout(handleReady, 2500);

    map.on('error', (e) => {
      console.warn('[HeroMap] MapLibre error:', e.error?.message || e);
    });

    return () => {
      clearTimeout(fallbackTimer);
      map.off('load', handleReady);
      // 'styledata' was registered with once() so it auto-removes after firing,
      // but if it hasn't fired yet we should clean it up too.
      map.off('styledata', handleReady);
      animatorRef.current?.destroy();
      animatorRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
