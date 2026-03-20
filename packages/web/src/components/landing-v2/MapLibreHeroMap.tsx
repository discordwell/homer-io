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

    map.on('load', handleReady);
    // Fallback: if load doesn't fire within 5s, show map anyway
    const fallbackTimer = setTimeout(handleReady, 5000);

    map.on('error', (e) => {
      console.warn('[HeroMap] MapLibre error:', e.error?.message || e);
    });

    return () => {
      clearTimeout(fallbackTimer);
      animatorRef.current?.destroy();
      animatorRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
