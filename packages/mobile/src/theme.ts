import { StyleSheet } from 'react-native';

/**
 * Design tokens — raw hex values matching packages/web/src/app.css :root.
 * The web app uses CSS variables; mobile uses these constants directly.
 */
export const C = {
  bg: '#06090F',
  bg2: '#0C1220',
  bg3: '#111827',
  surface: '#0C1220',
  card: '#111827',
  accent: '#F59E0B',
  accentDim: 'rgba(245, 158, 11, 0.25)',
  green: '#10B981',
  yellow: '#FBBF24',
  red: '#EF4444',
  orange: '#FB923C',
  purple: '#A78BFA',
  text: '#F1F5F9',
  dim: '#94A3B8',
  muted: '#64748B',
  border: '#1E293B',
} as const;

/** Semi-transparent variant of a theme color */
export function alpha(color: string, opacity: number): string {
  // Parse hex to rgba
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const F = {
  display: 'System',   // Will use expo-font for Cabinet Grotesk if bundled
  body: 'System',      // Will use expo-font for Inter if bundled
  mono: 'SpaceMono',   // Bundled with Expo by default
} as const;

export const Size = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

/** Shared base styles used across screens */
export const Base = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: C.border,
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: C.accent,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '600',
    fontSize: Size.md,
  },
  secondaryBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    backgroundColor: C.bg3,
    borderWidth: 1,
    borderColor: C.muted,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: C.dim,
    fontSize: Size.md,
  },
  input: {
    backgroundColor: C.bg2,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    color: C.text,
    fontSize: Size.md,
  },
});
