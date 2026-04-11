/**
 * CoAI Color System
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
  // Backgrounds — true black, coding-app style
  background: '#000000',
  backgroundSecondary: '#0a0a0a',
  card: '#111111',
  cardHover: '#1a1a1a',
  cardElevated: '#1e1e1e',

  // Text — neutral zinc tones for clean contrast on black
  foreground: '#f4f4f5',
  mutedForeground: '#a1a1aa',
  subtleForeground: '#71717a',

  // Primary
  primary: '#3b82f6',
  primaryHover: '#2563eb',
  primaryForeground: '#ffffff',

  // Secondary
  secondary: '#141414',
  secondaryHover: '#1c1c1c',
  secondaryForeground: '#d4d4d8',

  // Accent (gold)
  accent: '#c8a94b',
  accentHover: '#d7bb6a',
  accentMuted: '#8f7530',
  accentForeground: '#000000',

  // Muted
  muted: '#0a0a0a',

  // Semantic
  success: '#22c55e',
  successMuted: 'rgba(34, 197, 94, 0.14)',
  danger: '#f87171',
  dangerMuted: 'rgba(248, 113, 113, 0.14)',
  warning: '#f59e0b',
  warningMuted: 'rgba(245, 158, 11, 0.14)',
  info: '#38bdf8',
  infoMuted: 'rgba(56, 189, 248, 0.14)',

  // Border — neutral grays
  border: '#2a2a2a',
  borderSubtle: '#1a1a1a',
  borderStrong: '#3a3a3a',

  // Input
  input: '#0d0d0d',
  placeholder: '#52525b',
  ring: '#3b82f6',

  // Tab bar
  tabBarBackground: '#000000',
  tabBarActive: '#e4e4e7',
  tabBarInactive: '#71717a',
  tabBarBorder: '#1a1a1a',

  // Chat
  chatBubbleUser: '#141414',
  chatBubbleBot: '#111111',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.72)',
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
