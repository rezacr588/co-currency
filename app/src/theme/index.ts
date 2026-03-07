import { Platform } from 'react-native';
import { type ColorPalette } from '../constants/colors';

export interface ResponsiveToken {
  mobile: number;
  tablet: number;
  desktop: number;
}

export function resolveResponsiveToken(token: ResponsiveToken, width: number) {
  if (width >= 1024) {
    return token.desktop;
  }
  if (width >= 768) {
    return token.tablet;
  }
  return token.mobile;
}

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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
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

export function buildTypography(isRTL: boolean) {
  const fontFamily = Platform.select({
    ios: isRTL ? 'Vazirmatn_400Regular' : 'Inter_400Regular',
    android: isRTL ? 'Vazirmatn_400Regular' : 'Inter_400Regular',
    default: isRTL ? 'Vazirmatn_400Regular' : 'Inter_400Regular',
  });

  const fontFamilyMedium = Platform.select({
    ios: isRTL ? 'Vazirmatn_500Medium' : 'Inter_500Medium',
    android: isRTL ? 'Vazirmatn_500Medium' : 'Inter_500Medium',
    default: isRTL ? 'Vazirmatn_500Medium' : 'Inter_500Medium',
  });

  const fontFamilySemiBold = Platform.select({
    ios: isRTL ? 'Vazirmatn_600SemiBold' : 'Inter_600SemiBold',
    android: isRTL ? 'Vazirmatn_600SemiBold' : 'Inter_600SemiBold',
    default: isRTL ? 'Vazirmatn_600SemiBold' : 'Inter_600SemiBold',
  });

  const fontFamilyBold = Platform.select({
    ios: isRTL ? 'Vazirmatn_700Bold' : 'Inter_700Bold',
    android: isRTL ? 'Vazirmatn_700Bold' : 'Inter_700Bold',
    default: isRTL ? 'Vazirmatn_700Bold' : 'Inter_700Bold',
  });

  return {
    h1: {
      fontSize: 24,
      fontFamily: fontFamilyBold!,
      lineHeight: 32,
      letterSpacing: -0.4,
    },
    h2: {
      fontSize: 18,
      fontFamily: fontFamilySemiBold!,
      lineHeight: 24,
      letterSpacing: -0.2,
    },
    h3: {
      fontSize: 16,
      fontFamily: fontFamilySemiBold!,
      lineHeight: 22,
      letterSpacing: -0.1,
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
  };
}

// ─── Gradients ───────────────────────────────────────────────
const buildGradients = (colors: ColorPalette, isDark: boolean) => ({
  card: isDark
    ? [colors.card, colors.cardElevated]
    : [colors.cardElevated, colors.card],
  accent: [colors.primary, colors.primaryHover],
  premium: isDark
    ? ['#1b2436', '#2b354b', '#1b2436']
    : ['#fff6dd', '#f8ecd0', '#fff6dd'],
  success: ['#16a34a', '#22c55e'],
  danger: ['#dc2626', '#f87171'],
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
  backgroundColor: isDark ? 'rgba(18, 26, 42, 0.72)' : 'rgba(255, 255, 255, 0.72)',
});

const layout = {
  pageGutter: {
    mobile: 16,
    tablet: 24,
    desktop: 32,
  },
  sectionGap: {
    mobile: 24,
    tablet: 24,
    desktop: 32,
  },
  maxContentWidth: 1120,
  maxReadingWidth: 720,
  navRailWidth: {
    expanded: 240,
    collapsed: 72,
  },
  headerHeight: 64,
} as const;

// ─── AppTheme ────────────────────────────────────────────────
export interface AppTheme {
  colors: ColorPalette;
  isDark: boolean;
  isRTL: boolean;
  spacing: typeof spacing;
  radii: typeof radii;
  shadows: ReturnType<typeof buildShadows>;
  typography: ReturnType<typeof buildTypography>;
  gradients: ReturnType<typeof buildGradients>;
  animation: typeof animation;
  glass: ReturnType<typeof buildGlass>;
  layout: typeof layout;
}

export function buildTheme(colors: ColorPalette, isDark: boolean, isRTL: boolean = false): AppTheme {
  return {
    colors,
    isDark,
    isRTL,
    spacing,
    radii,
    shadows: buildShadows(isDark),
    typography: buildTypography(isRTL),
    gradients: buildGradients(colors, isDark),
    animation,
    glass: buildGlass(isDark),
    layout,
  };
}
