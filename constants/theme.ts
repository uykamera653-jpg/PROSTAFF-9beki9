import { Dimensions, PixelRatio, Platform } from 'react-native';

// ─── Screen metrics ───────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Normalise font sizes relative to a 375-pt baseline (iPhone 6/7/8)
const BASE_WIDTH = 375;
const scale = SCREEN_W / BASE_WIDTH;

/**
 * Scales a font size proportionally to the device screen width.
 * Clamps the result so very large / very small screens still look sensible.
 */
export function rf(size: number): number {
  const scaled = size * Math.min(scale, 1.4);
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/**
 * Scales a layout value (padding, margin, etc.) proportionally.
 */
export function rs(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * Math.min(scale, 1.3)));
}

/** Current screen dimensions (call inside components if you need live values). */
export const screen = { width: SCREEN_W, height: SCREEN_H };

// ─── Colors ───────────────────────────────────────────────────────────────────
export const colors = {
  light: {
    primary: '#3B82F6',
    primaryDark: '#2563EB',
    secondary: '#10B981',
    accent: '#F59E0B',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceVariant: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    gradient1: '#3B82F6',
    gradient2: '#2563EB',
    gradient3: '#10B981',
    dailyWorkers: '#3B82F6',
    serviceCompanies: '#10B981',
  },
  dark: {
    primary: '#60A5FA',
    primaryDark: '#3B82F6',
    secondary: '#34D399',
    accent: '#FBBF24',
    background: '#0F172A',
    surface: '#1E293B',
    surfaceVariant: '#334155',
    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textTertiary: '#94A3B8',
    border: '#334155',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    gradient1: '#60A5FA',
    gradient2: '#3B82F6',
    gradient3: '#34D399',
    dailyWorkers: '#60A5FA',
    serviceCompanies: '#34D399',
  },
};

// ─── Spacing ─────────────────────────────────────────────────────────────────
// Responsive spacing: each value scales with screen width
export const spacing = {
  xs:  rs(4),
  sm:  rs(8),
  md:  rs(16),
  lg:  rs(24),
  xl:  rs(32),
  xxl: rs(48),
};

// ─── Typography ──────────────────────────────────────────────────────────────
export const typography = {
  h1: {
    fontSize: rf(30),
    fontWeight: '700' as const,
    lineHeight: rf(38),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  h2: {
    fontSize: rf(24),
    fontWeight: '700' as const,
    lineHeight: rf(32),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  h3: {
    fontSize: rf(20),
    fontWeight: '600' as const,
    lineHeight: rf(28),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  h4: {
    fontSize: rf(17),
    fontWeight: '600' as const,
    lineHeight: rf(24),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  body: {
    fontSize: rf(15),
    fontWeight: '400' as const,
    lineHeight: rf(22),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  bodyMedium: {
    fontSize: rf(15),
    fontWeight: '500' as const,
    lineHeight: rf(22),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  caption: {
    fontSize: rf(13),
    fontWeight: '400' as const,
    lineHeight: rf(19),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
  small: {
    fontSize: rf(12),
    fontWeight: '400' as const,
    lineHeight: rf(16),
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
  },
};

// ─── Border Radius ───────────────────────────────────────────────────────────
export const borderRadius = {
  sm:   rs(8),
  md:   rs(12),
  lg:   rs(16),
  xl:   rs(24),
  full: 9999,
};

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 8,
  },
};

// ─── Layout helpers ──────────────────────────────────────────────────────────
/** Max content width — useful for tablets / large screens */
export const MAX_CONTENT_WIDTH = Math.min(SCREEN_W, 600);

/** Responsive column helper */
export function numColumns(): number {
  if (SCREEN_W >= 1024) return 3;
  if (SCREEN_W >= 600) return 2;
  return 1;
}
