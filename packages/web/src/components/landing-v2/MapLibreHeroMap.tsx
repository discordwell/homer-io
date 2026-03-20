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
  onReadyRef.current = onReady;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_KEY;
    if (!apiKey) {
      console.warn('[HeroMap] VITE_MAPTILER_KEY not set — staying on SVG fallback');
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildHeroStyle(apiKey),
      center: [lng, lat],
      zoom: 10,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    // Use 'load' (style + sources ready) instead of 'idle' (all tiles painted)
    // 'idle' can stall when container starts at opacity:0
    map.on('load', () => {
      if (!containerRef.current) return;

      // Brief delay to let initial tiles render into the canvas
      setTimeout(() => {
        if (!containerRef.current || !mapRef.current) return;

        const animator = new DriverAnimator(map, containerRef.current);
        animatorRef.current = animator;
        animator.start();

        onReadyRef.current();
      }, 300);
    });

    map.on('error', (e) => {
      console.warn('[HeroMap] MapLibre error:', e.error?.message || e);
    });

    return () => {
      animatorRef.current?.destroy();
      animatorRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
