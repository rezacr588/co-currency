/**
 * CoFinance Color System
 *
 * Centralized color definitions for light and dark themes.
 * Use the `useColors()` hook from ThemeContext to get the correct colors.
 */

export interface ColorPalette {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  card: string;
  cardHover: string;
  cardElevated: string;

  // Text
  foreground: string;
  mutedForeground: string;
  subtleForeground: string;

  // Primary (main actions)
  primary: string;
  primaryHover: string;
  primaryForeground: string;

  // Secondary
  secondary: string;
  secondaryHover: string;
  secondaryForeground: string;

  // Accent (gold)
  accent: string;
  accentHover: string;
  accentMuted: string;
  accentForeground: string;

  // Muted
  muted: string;

  // Semantic
  success: string;
  successMuted: string;
  danger: string;
  dangerMuted: string;
  warning: string;
  warningMuted: string;
  info: string;
  infoMuted: string;

  // Border
  border: string;
  borderSubtle: string;
  borderStrong: string;

  // Input
  input: string;
  placeholder: string;
  ring: string;

  // Tab bar
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
  tabBarBorder: string;

  // Chat
  chatBubbleUser: string;
  chatBubbleBot: string;

  // Overlay
  overlay: string;
}

export const darkColors: ColorPalette = {
  // Backgrounds
  background: '#09090b',
  backgroundSecondary: '#0f0f10',
  card: '#141416',
  cardHover: '#1a1a1d',
  cardElevated: '#1e1e21',

  // Text
  foreground: '#fafafa',
  mutedForeground: '#71717a',
  subtleForeground: '#52525b',

  // Primary
  primary: '#fafafa',
  primaryHover: '#e4e4e7',
  primaryForeground: '#09090b',

  // Secondary
  secondary: '#27272a',
  secondaryHover: '#3f3f46',
  secondaryForeground: '#a1a1aa',

  // Accent (gold)
  accent: '#d4af37',
  accentHover: '#e5c158',
  accentMuted: '#a68b2c',
  accentForeground: '#09090b',

  // Muted
  muted: '#18181b',

  // Semantic
  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  danger: '#ef4444',
  dangerMuted: 'rgba(239, 68, 68, 0.15)',
  warning: '#f59e0b',
  warningMuted: 'rgba(245, 158, 11, 0.15)',
  info: '#3b82f6',
  infoMuted: 'rgba(59, 130, 246, 0.15)',

  // Border
  border: '#27272a',
  borderSubtle: '#1f1f22',
  borderStrong: '#3f3f46',

  // Input
  input: '#18181b',
  placeholder: '#71717a',
  ring: '#52525b',

  // Tab bar
  tabBarBackground: '#09090b',
  tabBarActive: '#fafafa',
  tabBarInactive: '#71717a',
  tabBarBorder: '#27272a',

  // Chat
  chatBubbleUser: '#27272a',
  chatBubbleBot: '#141416',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const lightColors: ColorPalette = {
  // Backgrounds
  background: '#ffffff',
  backgroundSecondary: '#f8fafc',
  card: '#f1f5f9',
  cardHover: '#e2e8f0',
  cardElevated: '#ffffff',

  // Text
  foreground: '#0f172a',
  mutedForeground: '#64748b',
  subtleForeground: '#94a3b8',

  // Primary
  primary: '#0f172a',
  primaryHover: '#1e293b',
  primaryForeground: '#ffffff',

  // Secondary
  secondary: '#e2e8f0',
  secondaryHover: '#cbd5e1',
  secondaryForeground: '#475569',

  // Accent (gold)
  accent: '#b8960c',
  accentHover: '#d4af37',
  accentMuted: '#92780a',
  accentForeground: '#ffffff',

  // Muted
  muted: '#f1f5f9',

  // Semantic
  success: '#16a34a',
  successMuted: 'rgba(22, 163, 74, 0.12)',
  danger: '#dc2626',
  dangerMuted: 'rgba(220, 38, 38, 0.12)',
  warning: '#d97706',
  warningMuted: 'rgba(217, 119, 6, 0.12)',
  info: '#2563eb',
  infoMuted: 'rgba(37, 99, 235, 0.12)',

  // Border
  border: '#e2e8f0',
  borderSubtle: '#f1f5f9',
  borderStrong: '#cbd5e1',

  // Input
  input: '#f1f5f9',
  placeholder: '#94a3b8',
  ring: '#cbd5e1',

  // Tab bar
  tabBarBackground: '#ffffff',
  tabBarActive: '#0f172a',
  tabBarInactive: '#94a3b8',
  tabBarBorder: '#e2e8f0',

  // Chat
  chatBubbleUser: '#e2e8f0',
  chatBubbleBot: '#f1f5f9',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.3)',
};
