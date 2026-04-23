import type maplibregl from 'maplibre-gl';

const MAPLIBRE_VERSION = '5.20.2';
const MAPLIBRE_SCRIPT_ID = 'homer-maplibre-script';
const MAPLIBRE_STYLESHEET_ID = 'homer-maplibre-stylesheet';
const MAPLIBRE_SCRIPT_SRC = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_STYLESHEET_HREF = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

declare global {
  interface Window {
    maplibregl?: typeof maplibregl;
  }
}

let loadPromise: Promise<typeof maplibregl> | null = null;

function ensureStylesheet() {
  if (document.getElementById(MAPLIBRE_STYLESHEET_ID)) return;

  const link = document.createElement('link');
  link.id = MAPLIBRE_STYLESHEET_ID;
  link.rel = 'stylesheet';
  link.href = MAPLIBRE_STYLESHEET_HREF;
  document.head.appendChild(link);
}

function loadScript(): Promise<typeof maplibregl> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(MAPLIBRE_SCRIPT_ID) as HTMLScriptElement | null;

    const handleResolve = () => {
      if (window.maplibregl) {
        resolve(window.maplibregl);
        return;
      }

      reject(new Error('MapLibre loaded without exposing window.maplibregl'));
    };

    if (existing) {
      existing.addEventListener('load', handleResolve, { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load MapLibre script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = MAPLIBRE_SCRIPT_ID;
    script.src = MAPLIBRE_SCRIPT_SRC;
    script.async = true;
    script.onload = handleResolve;
    script.onerror = () => reject(new Error('Failed to load MapLibre script'));
    document.head.appendChild(script);
  });
}

export async function loadMapLibre() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('MapLibre can only load in the browser');
  }

  if (window.maplibregl) {
    return window.maplibregl;
  }

  ensureStylesheet();

  if (!loadPromise) {
    loadPromise = loadScript().catch((error) => {
      loadPromise = null;
      throw error;
    });
  }

  return loadPromise;
}
