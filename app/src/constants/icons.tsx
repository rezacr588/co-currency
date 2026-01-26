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
  type LucideIcon,
} from 'lucide-react-native';
import React from 'react';
import Svg, { Path } from 'react-native-svg';

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
  food: Utensils,
  transportation: Car,
  entertainment: Film,
  shopping: ShoppingCart,
  bills: FileText,
  income: Banknote,
  transfer: ArrowLeftRight,
  other: Package,
};

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
}

// Helper component to render icons consistently
export function CategoryIcon({ category, size = 24, color }: CategoryIconProps) {
  const IconComponent = CATEGORY_ICONS[category] || Package;
  return <IconComponent size={size} color={color} />;
}

interface GoalIconProps extends IconProps {
  category: string;
}

export function GoalIcon({ category, size = 24, color }: GoalIconProps) {
  const IconComponent = GOAL_ICONS[category] || Target;
  return <IconComponent size={size} color={color} />;
}

interface FrequencyIconProps extends IconProps {
  frequency: string;
}

export function FrequencyIcon({ frequency, size = 16, color }: FrequencyIconProps) {
  const IconComponent = FREQUENCY_ICONS[frequency] || Calendar;
  return <IconComponent size={size} color={color} />;
}

// Re-export Globe for use as fallback flag
export { Globe };
