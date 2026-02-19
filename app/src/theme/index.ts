import { Platform } from 'react-native';
import { type ColorPalette } from '../constants/colors';

// ─── Spacing Scale ───────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radii ────────────────────────────────────────────
export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  xxl: 24,
  full: 9999,
} as const;

// ─── Shadows ─────────────────────────────────────────────────
export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const buildShadows = (isDark: boolean) => ({
  sm: {
    shadowColor: isDark ? '#000' : '#64748b',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0.3 : 0.08,
    shadowRadius: 3,
    elevation: 2,
  } as Shadow,
  md: {
    shadowColor: isDark ? '#000' : '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.4 : 0.12,
    shadowRadius: 8,
    elevation: 4,
  } as Shadow,
  lg: {
    shadowColor: isDark ? '#000' : '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDark ? 0.5 : 0.16,
    shadowRadius: 16,
    elevation: 8,
  } as Shadow,
  glow: (color: string): Shadow => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: isDark ? 0.4 : 0.25,
    shadowRadius: 12,
    elevation: 6,
  }),
});

// ─── Typography ──────────────────────────────────────────────
export interface TypographyPreset {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
}

const fontFamily = Platform.select({
  ios: 'Inter_400Regular',
  android: 'Inter_400Regular',
  default: 'Inter_400Regular',
});

const fontFamilyMedium = Platform.select({
  ios: 'Inter_500Medium',
  android: 'Inter_500Medium',
  default: 'Inter_500Medium',
});

const fontFamilySemiBold = Platform.select({
  ios: 'Inter_600SemiBold',
  android: 'Inter_600SemiBold',
  default: 'Inter_600SemiBold',
});

const fontFamilyBold = Platform.select({
  ios: 'Inter_700Bold',
  android: 'Inter_700Bold',
  default: 'Inter_700Bold',
});

export const typography = {
  h1: {
    fontSize: 28,
    fontFamily: fontFamilyBold!,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontFamily: fontFamilySemiBold!,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontFamily: fontFamilySemiBold!,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 15,
    fontFamily: fontFamily!,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontSize: 15,
    fontFamily: fontFamilyMedium!,
    lineHeight: 22,
    letterSpacing: 0,
  },
  caption: {
    fontSize: 12,
    fontFamily: fontFamily!,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 11,
    fontFamily: fontFamilySemiBold!,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
} as const;

// ─── Gradients ───────────────────────────────────────────────
const buildGradients = (colors: ColorPalette, isDark: boolean) => ({
  card: isDark
    ? [colors.card, colors.cardElevated]
    : [colors.cardElevated, colors.card],
  accent: [colors.accent, colors.accentHover],
  premium: isDark
    ? ['#0f0f12', '#141418', '#0f0f12']
    : ['#f8fafc', '#ffffff', '#f8fafc'],
  success: ['#16a34a', '#22c55e'],
  danger: ['#dc2626', '#ef4444'],
});

// ─── Animation Timings ───────────────────────────────────────
export const animation = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

// ─── Glass ───────────────────────────────────────────────────
const buildGlass = (isDark: boolean) => ({
  intensity: 20,
  tint: (isDark ? 'dark' : 'light') as 'dark' | 'light',
  backgroundColor: isDark ? 'rgba(20, 20, 22, 0.6)' : 'rgba(255, 255, 255, 0.6)',
});

// ─── AppTheme ────────────────────────────────────────────────
export interface AppTheme {
  colors: ColorPalette;
  isDark: boolean;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: ReturnType<typeof buildShadows>;
  typography: typeof typography;
  gradients: ReturnType<typeof buildGradients>;
  animation: typeof animation;
  glass: ReturnType<typeof buildGlass>;
}

export function buildTheme(colors: ColorPalette, isDark: boolean): AppTheme {
  return {
    colors,
    isDark,
    spacing,
    radii,
    shadows: buildShadows(isDark),
    typography,
    gradients: buildGradients(colors, isDark),
    animation,
    glass: buildGlass(isDark),
  };
}
