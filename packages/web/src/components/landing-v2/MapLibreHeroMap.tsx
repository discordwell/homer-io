import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { buildHeroStyle, applyHeroPaint } from './maplibreStyle.js';
import { useThemeStore } from '../../stores/theme.js';
import { DriverAnimator } from './driverAnimator.js';
import { loadMapLibre } from './loadMapLibre.js';

interface MapLibreHeroMapProps {
  lat: number;
  lng: number;
  onReady: () => void;
  onError: () => void;
}

function toError(error: unknown) {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : 'Unknown map error');
}

export default function MapLibreHeroMap({ lat, lng, onReady, onError }: MapLibreHeroMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const animatorRef = useRef<DriverAnimator | null>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const readyFired = useRef(false);
  const resolvedTheme = useThemeStore((s) => s.resolved);
  const themeRef = useRef(resolvedTheme);

  // Mirror callback props into refs so the init effect can call the latest
  // versions without retriggering on every render.
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
    themeRef.current = resolvedTheme;
  });

  // Repaint in place on theme change. The init effect below is keyed only on
  // position, so it must not re-run here — a rebuilt map would restart the
  // driver animation from scratch.
  useEffect(() => {
    const map = mapRef.current;
    if (map) applyHeroPaint(map, resolvedTheme);
    // The driver dots paint to a Canvas overlay, which cannot read CSS
    // variables — they have to be recolored explicitly.
    animatorRef.current?.setTheme(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const apiKey = import.meta.env.VITE_MAPTILER_KEY;
    if (!apiKey) {
      console.warn('[HeroMap] VITE_MAPTILER_KEY not set — staying on SVG fallback');
      return;
    }

    const handleFatalError = (error: unknown) => {
      if (readyFired.current) return;
      const normalizedError = toError(error);
      console.warn('[HeroMap] Disabling MapLibre and falling back to SVG:', normalizedError.message);
      onErrorRef.current();
    };

    const handleContextCreationError = (event: Event) => {
      if ('preventDefault' in event && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }

      const detail = event as Event & { message?: string; statusMessage?: string };
      handleFatalError(detail.statusMessage || detail.message || 'Failed to initialize WebGL');
    };

    let cleanupMap: (() => void) | null = null;
    let cancelled = false;

    loadMapLibre()
      .then((maplibre) => {
        if (cancelled || mapRef.current) return;

        let map: maplibregl.Map;
        try {
          map = new maplibre.Map({
            container,
            style: buildHeroStyle(apiKey, themeRef.current),
            center: [lng, lat],
            zoom: 10,
            interactive: false,
            attributionControl: false,
            fadeDuration: 0,
          });
        } catch (error) {
          handleFatalError(error);
          return;
        }

        mapRef.current = map;
        container.addEventListener('webglcontextcreationerror', handleContextCreationError);

        const handleReady = () => {
          if (readyFired.current) return;
          readyFired.current = true;

          try {
            // Between construction and style parse, applyHeroPaint's getLayer()
            // guards drop every update — re-apply now that the layers exist.
            applyHeroPaint(map, themeRef.current);
            const animator = new DriverAnimator(map, container, themeRef.current);
            animatorRef.current = animator;
            animator.start();
          } catch (error) {
            handleFatalError(error);
            return;
          }

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

        const handleMapError = (event: { error?: Error }) => {
          if (!readyFired.current) {
            handleFatalError(event.error || 'Map failed during initialization');
            return;
          }

          console.warn('[HeroMap] MapLibre error:', event.error?.message || event);
        };
        map.on('error', handleMapError);

        cleanupMap = () => {
          clearTimeout(fallbackTimer);
          map.off('load', handleReady);
          map.off('error', handleMapError);
          map.off('styledata', handleReady);
          container.removeEventListener('webglcontextcreationerror', handleContextCreationError);
          animatorRef.current?.destroy();
          animatorRef.current = null;
          map.remove();
          mapRef.current = null;
        };

        if (cancelled) {
          cleanupMap();
        }
      })
      .catch((error) => {
        if (!cancelled) {
          handleFatalError(error);
        }
      });

    return () => {
      cancelled = true;
      cleanupMap?.();
    };
  }, [lat, lng]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
