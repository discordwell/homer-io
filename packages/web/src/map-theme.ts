import { useThemeStore, type ResolvedTheme } from './stores/theme.js';

/**
 * Map colors, as literal hex.
 *
 * Browsers DO resolve `var()` in SVG presentation attributes, so Leaflet's SVG
 * renderer would cope with a token. Three things on a map do not:
 *   - Canvas 2D (`fillStyle`/`strokeStyle` parse without CSS context, so a
 *     `var()` string is rejected and the shape paints black) — Leaflet falls
 *     back to its Canvas renderer on large layer counts and `preferCanvas`,
 *     and the hero driver animation is Canvas-only.
 *   - MapLibre style specs, read by the GL renderer rather than CSS.
 *   - Raster tile URLs, which are not colors at all.
 * Rather than track which layer type is renderer-safe, every map color comes
 * from here so the whole surface is renderer-independent.
 */
export interface MapPalette {
  /** Basemap raster tiles, matched to the theme. */
  tileUrl: string;
  /** Brand amber — routes, driver dots, active stops. */
  accent: string;
  /** "Live"/on-time green. */
  green: string;
  /** Completed / inactive route segments. */
  dim: string;
  /** Problem / destination markers. */
  red: string;
  /** Ring drawn around a filled marker so it separates from the basemap. */
  markerStroke: string;
  /** Text sitting on an accent-filled marker. */
  onAccent: string;
  /** Drop shadow under numbered stop pins. */
  markerShadow: string;
}

const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

export const CARTO_ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a>';

const PALETTES: Record<ResolvedTheme, MapPalette> = {
  dark: {
    tileUrl: CARTO_DARK,
    accent: '#F59E0B',
    green: '#22C55E',
    dim: '#6B7280',
    red: '#EF4444',
    markerStroke: '#FFFFFF',
    onAccent: '#0A0A0A',
    markerShadow: 'rgba(0, 0, 0, 0.45)',
  },
  light: {
    tileUrl: CARTO_LIGHT,
    // Deepened so routes stay legible over pale Carto Light tiles, where
    // bright #F59E0B washes out.
    accent: '#B45309',
    green: '#047857',
    dim: '#94A3B8',
    red: '#DC2626',
    // A white ring vanishes on light tiles; a slate ring reads on both.
    markerStroke: '#1F2937',
    onAccent: '#FFFFFF',
    markerShadow: 'rgba(15, 23, 42, 0.25)',
  },
};

export function getMapPalette(resolved: ResolvedTheme): MapPalette {
  return PALETTES[resolved];
}

/** Map palette for the active theme; re-renders the caller on theme change. */
export function useMapPalette(): MapPalette {
  return useThemeStore((s) => PALETTES[s.resolved]);
}
