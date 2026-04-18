import {
  Utensils,
  Car,
  Film,
  ShoppingCart,
  FileText,
  Banknote,
  ArrowLeftRight,
  Package,
  Target,
  AlertTriangle,
  Plane,
  Home,
  GraduationCap,
  User,
  TrendingUp,
  CreditCard,
  Calendar,
  CalendarDays,
  CalendarRange,
  BarChart3,
  Repeat,
  PieChart,
  Bot,
  Moon,
  Globe,
  Zap,
  CheckCircle,
  Wallet,
  RefreshCw,
  Pill,
  Gamepad2,
  Smartphone,
  Lightbulb,
  BookOpen,
  Shirt,
  Gift,
  Landmark,
  Coffee,
  Pizza,
  Bus,
  Receipt,
  MoreHorizontal,
  Heart,
  Dumbbell,
  Music,
  Wrench,
  Baby,
  Dog,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

// ============================================
// Icon Size Constants for Consistency
// ============================================
export const ICON_SIZES = {
  /** Extra small icons - 12px (badges, inline indicators) */
  xs: 12,
  /** Small icons - 16px (secondary actions, labels) */
  sm: 16,
  /** Medium icons - 20px (list items, cards) */
  md: 20,
  /** Default icons - 24px (standard UI elements) */
  default: 24,
  /** Large icons - 32px (feature highlights, empty states) */
  lg: 32,
  /** Extra large icons - 48px (hero sections, large empty states) */
  xl: 48,
} as const;

// ============================================
// Icon Color Hook
// ============================================
// Theme-aware icon colors. Prefer this over passing hex literals.
// Returns an object with semantic names; values adapt to light/dark theme.
export function useIconColors() {
  const theme = useTheme();
  return {
    muted: theme.colors.mutedForeground,
    subtle: theme.colors.subtleForeground,
    accent: theme.colors.accent,
    success: theme.colors.success,
    danger: theme.colors.danger,
    warning: theme.colors.warning,
    info: theme.colors.info,
    foreground: theme.colors.foreground,
    secondary: theme.colors.mutedForeground,
  };
}

interface IconProps {
  size?: number;
  color?: string;
}

export function LinkedInIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </Svg>
  );
}

export function GoogleIcon({ size = 24, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Primary categories
  food: Utensils,
  transportation: Car,
  entertainment: Film,
  shopping: ShoppingCart,
  bills: Receipt,
  income: Banknote,
  transfer: ArrowLeftRight,
  other: MoreHorizontal,
  // Extended categories
  health: Heart,
  fitness: Dumbbell,
  education: GraduationCap,
  utilities: Lightbulb,
  home: Home,
  travel: Plane,
  gifts: Gift,
  coffee: Coffee,
  music: Music,
  gaming: Gamepad2,
  phone: Smartphone,
  clothing: Shirt,
  maintenance: Wrench,
  childcare: Baby,
  pets: Dog,
  internet: Wifi,
  bank: Landmark,
  healthcare: Pill,
};

// ============================================
// Category Colors - Minimal Grayscale
// Use grayscale by default, only use color when absolutely needed
// ============================================
export const CATEGORY_COLORS: Record<string, string> = {
  // All categories use the same neutral gray for minimal look
  // Color is applied only through semantic meaning (income=green, expense=red)
  food: '#a1a1aa',           // zinc-400
  transportation: '#a1a1aa', // zinc-400
  entertainment: '#a1a1aa',  // zinc-400
  shopping: '#a1a1aa',       // zinc-400
  bills: '#a1a1aa',          // zinc-400
  income: '#22c55e',         // green - semantic: positive
  transfer: '#a1a1aa',       // zinc-400
  other: '#71717a',          // zinc-500
  // Extended categories
  health: '#a1a1aa',         // zinc-400
  fitness: '#a1a1aa',        // zinc-400
  education: '#a1a1aa',      // zinc-400
  utilities: '#a1a1aa',      // zinc-400
  home: '#a1a1aa',           // zinc-400
  travel: '#a1a1aa',         // zinc-400
  gifts: '#a1a1aa',          // zinc-400
  coffee: '#a1a1aa',         // zinc-400
  music: '#a1a1aa',          // zinc-400
  gaming: '#a1a1aa',         // zinc-400
  phone: '#a1a1aa',          // zinc-400
  clothing: '#a1a1aa',       // zinc-400
  maintenance: '#71717a',    // zinc-500
  childcare: '#a1a1aa',      // zinc-400
  pets: '#a1a1aa',           // zinc-400
  internet: '#a1a1aa',       // zinc-400
  bank: '#a1a1aa',           // zinc-400
  healthcare: '#a1a1aa',     // zinc-400
};

/**
 * Get a subtle background color for a category with configurable opacity.
 * Useful for creating colored backgrounds on cards or icons.
 *
 * @param category - Category name
 * @param opacity - Background opacity (default: 0.1)
 * @returns RGBA color string or 'transparent' if category not found
 */
export function getCategoryBackground(category: string, opacity = 0.1): string {
  const color = CATEGORY_COLORS[category.toLowerCase()];
  if (!color) return 'transparent';
  // Convert rgb to rgba with opacity
  return color.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
}

export const GOAL_ICONS: Record<string, LucideIcon> = {
  savings: Banknote,
  emergency_fund: AlertTriangle,
  vacation: Plane,
  home: Home,
  car: Car,
  education: GraduationCap,
  retirement: User,
  investment: TrendingUp,
  debt_payoff: CreditCard,
  other: Target,
};

export const FREQUENCY_ICONS: Record<string, LucideIcon> = {
  daily: Calendar,
  weekly: CalendarDays,
  monthly: CalendarRange,
  yearly: BarChart3,
};

export const FEATURE_ICONS: Record<string, LucideIcon> = {
  converter: RefreshCw,
  wallet: Wallet,
  goals: Target,
  budgets: PieChart,
  recurring: Repeat,
  reports: BarChart3,
  ai: Bot,
  darkMode: Moon,
  languages: Globe,
  fast: Zap,
  accurate: CheckCircle,
  global: Globe,
};

// Transaction icons for the emoji picker replacement
export const TRANSACTION_ICONS: { icon: LucideIcon; label: string }[] = [
  { icon: Utensils, label: 'Food' },
  { icon: ShoppingCart, label: 'Shopping' },
  { icon: Banknote, label: 'Money' },
  { icon: Home, label: 'Home' },
  { icon: Car, label: 'Car' },
  { icon: Plane, label: 'Travel' },
  { icon: Pill, label: 'Health' },
  { icon: Gamepad2, label: 'Gaming' },
  { icon: Smartphone, label: 'Phone' },
  { icon: Lightbulb, label: 'Utilities' },
  { icon: Film, label: 'Entertainment' },
  { icon: BookOpen, label: 'Education' },
  { icon: Shirt, label: 'Clothing' },
  { icon: Gift, label: 'Gift' },
  { icon: CreditCard, label: 'Payment' },
  { icon: Landmark, label: 'Bank' },
  { icon: Package, label: 'Package' },
  { icon: Coffee, label: 'Coffee' },
  { icon: Pizza, label: 'Pizza' },
  { icon: Bus, label: 'Transport' },
];

interface CategoryIconProps extends IconProps {
  category: string;
  /** When true, uses the category's color instead of the provided color */
  useColor?: boolean;
}

/**
 * Renders a category icon based on the category name.
 * Falls back to Package icon if category is not found.
 *
 * @param category - Category name (food, transportation, etc.)
 * @param size - Icon size (default: 24)
 * @param color - Icon color (default: muted foreground)
 * @param useColor - When true, uses the category's assigned color
 */
export function CategoryIcon({
  category,
  size = ICON_SIZES.default,
  color,
  useColor = false,
}: CategoryIconProps) {
  const iconColors = useIconColors();
  const IconComponent = CATEGORY_ICONS[category.toLowerCase()] || Package;
  const iconColor = useColor
    ? CATEGORY_COLORS[category.toLowerCase()] || color || iconColors.muted
    : color || iconColors.muted;
  return <IconComponent size={size} color={iconColor} />;
}

interface StyledCategoryIconProps extends CategoryIconProps {
  /** Background opacity (default: 0.15) */
  backgroundOpacity?: number;
  /** Border radius (default: 12) */
  borderRadius?: number;
  /** Padding around the icon (default: 10) */
  padding?: number;
}

/**
 * Renders a category icon with a minimal dark background.
 * Uses subtle gray backgrounds for a clean, minimal look.
 *
 * @param category - Category name (food, transportation, etc.)
 * @param size - Icon size (default: 18)
 * @param backgroundOpacity - Background opacity (not used in minimal design)
 * @param borderRadius - Border radius in pixels (default: 8)
 * @param padding - Padding around the icon (default: 8)
 */
export function StyledCategoryIcon({
  category,
  size = 18,
  borderRadius = 8,
  padding = 8,
}: StyledCategoryIconProps) {
  const theme = useTheme();
  const iconColors = useIconColors();
  const IconComponent = CATEGORY_ICONS[category.toLowerCase()] || Package;

  return (
    <View
      style={{
        backgroundColor: theme.colors.secondary,
        borderRadius,
        padding,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent size={size} color={iconColors.secondary} />
    </View>
  );
}

interface GoalIconProps extends IconProps {
  category: string;
}

/**
 * Renders a goal category icon based on the goal type.
 * Falls back to Target icon if category is not found.
 *
 * @param category - Goal category (savings, vacation, etc.)
 * @param size - Icon size (default: 24)
 * @param color - Icon color (default: muted foreground)
 */
export function GoalIcon({
  category,
  size = ICON_SIZES.default,
  color,
}: GoalIconProps) {
  const iconColors = useIconColors();
  const IconComponent = GOAL_ICONS[category.toLowerCase()] || Target;
  return <IconComponent size={size} color={color ?? iconColors.muted} />;
}

interface FrequencyIconProps extends IconProps {
  frequency: string;
}

/**
 * Renders a frequency icon for recurring transactions.
 * Falls back to Calendar icon if frequency is not found.
 *
 * @param frequency - Frequency type (daily, weekly, monthly, yearly)
 * @param size - Icon size (default: 16 for inline use)
 * @param color - Icon color (default: muted foreground)
 */
export function FrequencyIcon({
  frequency,
  size = ICON_SIZES.sm,
  color,
}: FrequencyIconProps) {
  const iconColors = useIconColors();
  const IconComponent = FREQUENCY_ICONS[frequency.toLowerCase()] || Calendar;
  return <IconComponent size={size} color={color ?? iconColors.muted} />;
}

/**
 * Renders a feature icon for the app features list.
 * Falls back to Zap icon if feature is not found.
 *
 * @param feature - Feature name (converter, wallet, etc.)
 * @param size - Icon size (default: 24)
 * @param color - Icon color (default: accent gold)
 */
export function FeatureIcon({
  feature,
  size = ICON_SIZES.default,
  color,
}: { feature: string; size?: number; color?: string }) {
  const iconColors = useIconColors();
  const IconComponent = FEATURE_ICONS[feature.toLowerCase()] || Zap;
  return <IconComponent size={size} color={color ?? iconColors.accent} />;
}

// Re-export Globe for use as fallback flag
export { Globe };
