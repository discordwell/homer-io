import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl';
import type { ResolvedTheme } from '../../stores/theme.js';

/**
 * Paint values for the hero basemap, per theme.
 *
 * MapLibre style specs are parsed by the GL renderer, not CSS — `var(--token)`
 * is not resolvable here, so these have to be literal colors.
 *
 * The light ramp is not a mechanical inversion: on a pale basemap the roads
 * need to be *darker* than the land to read at all, which reverses the
 * figure/ground relationship the dark ramp relies on.
 */
interface HeroPaint {
  background: string;
  water: string;
  landcover: string;
  building: string;
  roadMinor: string;
  roadSecondary: string;
  roadPrimary: string;
  bridge: string;
  bridgeOpacity: number;
  label: string;
  labelHalo: string;
}

const HERO_PAINT: Record<ResolvedTheme, HeroPaint> = {
  dark: {
    background: '#06090F',
    water: '#0A1628',
    landcover: '#0D1520',
    building: '#0E1525',
    roadMinor: '#141F30',
    roadSecondary: '#192A45',
    roadPrimary: '#1E3055',
    bridge: '#F59E0B',
    bridgeOpacity: 0.45,
    label: '#94A3B8',
    labelHalo: '#06090F',
  },
  light: {
    background: '#F2F5F9',
    water: '#D7E3F0',
    landcover: '#E4EDE3',
    building: '#E2E8F0',
    roadMinor: '#D2DAE4',
    roadSecondary: '#BFC9D6',
    roadPrimary: '#A7B4C4',
    bridge: '#B45309',
    bridgeOpacity: 0.55,
    label: '#475569',
    labelHalo: '#FFFFFF',
  },
};

export function buildHeroStyle(apiKey: string, theme: ResolvedTheme = 'dark'): StyleSpecification {
  const paint = HERO_PAINT[theme];
  return {
    version: 8,
    name: 'homer-command-center',
    sources: {
      openmaptiles: {
        type: 'vector',
        tiles: [`https://api.maptiler.com/tiles/v3/{z}/{x}/{y}.pbf?key=${apiKey}`],
        maxzoom: 14,
      },
    },
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
    layers: [
      // Background
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': paint.background },
      },
      // Water
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': paint.water },
      },
      // Landcover (parks, etc) — very subtle
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': paint.landcover, 'fill-opacity': 0.5 },
      },
      // Building footprints — subtle dark
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        paint: { 'fill-color': paint.building, 'fill-opacity': 0.6 },
      },
      // Minor roads
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['in', 'class', 'minor', 'service', 'track']],
        paint: {
          'line-color': paint.roadMinor,
          'line-width': 0.8,
        },
      },
      // Secondary/tertiary roads
      {
        id: 'road-secondary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'secondary', 'tertiary'],
        paint: {
          'line-color': paint.roadSecondary,
          'line-width': 1.2,
        },
      },
      // Primary roads (used for driver animation extraction)
      {
        id: 'road-primary',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'trunk', 'motorway'],
        paint: {
          'line-color': paint.roadPrimary,
          'line-width': 2,
        },
      },
      // Bridge casings — amber accent
      {
        id: 'bridge',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['==', 'brunnel', 'bridge'], ['in', 'class', 'primary', 'trunk', 'motorway']],
        paint: {
          'line-color': paint.bridge,
          'line-width': 3,
          'line-opacity': paint.bridgeOpacity,
        },
      },
      // City labels
      {
        id: 'place-city',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town'],
        layout: {
          'text-field': '{name:latin}',
          'text-font': ['Noto Sans Regular'],
          'text-size': 12,
          'text-max-width': 8,
        },
        paint: {
          'text-color': paint.label,
          'text-opacity': 0.7,
          'text-halo-color': paint.labelHalo,
          'text-halo-width': 1.5,
        },
      },
    ],
  };
}

/**
 * Repaint an already-initialized hero map for a new theme.
 *
 * Uses setPaintProperty rather than setStyle: a style swap tears down and
 * rebuilds every source, which would invalidate the road geometry
 * DriverAnimator extracted at load and strand the animated drivers.
 */
export function applyHeroPaint(map: MapLibreMap, theme: ResolvedTheme): void {
  const paint = HERO_PAINT[theme];
  const updates: Array<[string, string, string | number]> = [
    ['background', 'background-color', paint.background],
    ['water', 'fill-color', paint.water],
    ['landcover', 'fill-color', paint.landcover],
    ['building', 'fill-color', paint.building],
    ['road-minor', 'line-color', paint.roadMinor],
    ['road-secondary', 'line-color', paint.roadSecondary],
    ['road-primary', 'line-color', paint.roadPrimary],
    ['bridge', 'line-color', paint.bridge],
    ['bridge', 'line-opacity', paint.bridgeOpacity],
    ['place-city', 'text-color', paint.label],
    ['place-city', 'text-halo-color', paint.labelHalo],
  ];

  for (const [layerId, property, value] of updates) {
    // getLayer guards the window between construction and style parse, where
    // the layers do not exist yet and setPaintProperty would throw.
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, property, value);
  }
}
