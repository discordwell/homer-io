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

    map.once('idle', () => {
      if (!containerRef.current) return;

      // Start driver animation on roads
      const animator = new DriverAnimator(map, containerRef.current);
      animatorRef.current = animator;
      animator.start();

      // Signal parent to crossfade
      onReadyRef.current();
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
