import type { StyleSpecification } from 'maplibre-gl';

export function buildHeroStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    name: 'homer-command-center',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: `https://api.maptiler.com/tiles/v3/tiles.json?key=${apiKey}`,
      },
    },
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
    layers: [
      // Background
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#06090F' },
      },
      // Water
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#0A1628' },
      },
      // Landcover (parks, etc) — very subtle
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#0D1520', 'fill-opacity': 0.5 },
      },
      // Building footprints — subtle dark
      {
        id: 'building',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'building',
        paint: { 'fill-color': '#0E1525', 'fill-opacity': 0.6 },
      },
      // Minor roads
      {
        id: 'road-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['all', ['in', 'class', 'minor', 'service', 'track']],
        paint: {
          'line-color': '#141F30',
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
          'line-color': '#192A45',
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
          'line-color': '#1E3055',
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
          'line-color': '#F59E0B',
          'line-width': 3,
          'line-opacity': 0.45,
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
          'text-color': '#94A3B8',
          'text-opacity': 0.7,
          'text-halo-color': '#06090F',
          'text-halo-width': 1.5,
        },
      },
    ],
  };
}
