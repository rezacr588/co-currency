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
  background: '#0b1220',
  backgroundSecondary: '#111827',
  card: '#121a2a',
  cardHover: '#182235',
  cardElevated: '#1c2740',

  // Text
  foreground: '#f8fafc',
  mutedForeground: '#94a3b8',
  subtleForeground: '#64748b',

  // Primary
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryForeground: '#ffffff',

  // Secondary
  secondary: '#172033',
  secondaryHover: '#1f2a40',
  secondaryForeground: '#cbd5e1',

  // Accent (gold)
  accent: '#c8a94b',
  accentHover: '#d7bb6a',
  accentMuted: '#8f7530',
  accentForeground: '#0b1220',

  // Muted
  muted: '#0f172a',

  // Semantic
  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.14)',
  danger: '#f87171',
  dangerMuted: 'rgba(248, 113, 113, 0.14)',
  warning: '#f59e0b',
  warningMuted: 'rgba(245, 158, 11, 0.14)',
  info: '#38bdf8',
  infoMuted: 'rgba(56, 189, 248, 0.14)',

  // Border
  border: '#263247',
  borderSubtle: '#1d2739',
  borderStrong: '#334155',

  // Input
  input: '#111827',
  placeholder: '#64748b',
  ring: '#3b82f6',

  // Tab bar
  tabBarBackground: '#0b1220',
  tabBarActive: '#e2e8f0',
  tabBarInactive: '#64748b',
  tabBarBorder: '#1f2937',

  // Chat
  chatBubbleUser: '#172033',
  chatBubbleBot: '#121a2a',

  // Overlay
  overlay: 'rgba(2, 6, 23, 0.64)',
};

export const lightColors: ColorPalette = {
  // Backgrounds
  background: '#f5f7fb',
  backgroundSecondary: '#eef2f7',
  card: '#ffffff',
  cardHover: '#f8fafc',
  cardElevated: '#ffffff',

  // Text
  foreground: '#0f172a',
  mutedForeground: '#475569',
  subtleForeground: '#94a3b8',

  // Primary
  primary: '#2563eb',
  primaryHover: '#1d4ed8',
  primaryForeground: '#ffffff',

  // Secondary
  secondary: '#eff3f8',
  secondaryHover: '#e2e8f0',
  secondaryForeground: '#334155',

  // Accent (gold)
  accent: '#b68a2d',
  accentHover: '#c79a37',
  accentMuted: '#8d6a1f',
  accentForeground: '#0f172a',

  // Muted
  muted: '#f8fafc',

  // Semantic
  success: '#16a34a',
  successMuted: 'rgba(22, 163, 74, 0.1)',
  danger: '#dc2626',
  dangerMuted: 'rgba(220, 38, 38, 0.1)',
  warning: '#d97706',
  warningMuted: 'rgba(217, 119, 6, 0.1)',
  info: '#2563eb',
  infoMuted: 'rgba(37, 99, 235, 0.1)',

  // Border
  border: '#d9e2ef',
  borderSubtle: '#e7edf5',
  borderStrong: '#c3cfdf',

  // Input
  input: '#ffffff',
  placeholder: '#94a3b8',
  ring: '#93c5fd',

  // Tab bar
  tabBarBackground: '#ffffff',
  tabBarActive: '#1d4ed8',
  tabBarInactive: '#64748b',
  tabBarBorder: '#d9e2ef',

  // Chat
  chatBubbleUser: '#eff3f8',
  chatBubbleBot: '#ffffff',

  // Overlay
  overlay: 'rgba(15, 23, 42, 0.24)',
};
