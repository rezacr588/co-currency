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
} from 'lucide-react';

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

// Helper component to render icons consistently
export function CategoryIcon({
  category,
  className = 'w-6 h-6',
}: {
  category: string;
  className?: string;
}) {
  const IconComponent = CATEGORY_ICONS[category] || Package;
  return <IconComponent className={className} />;
}

export function GoalIcon({
  category,
  className = 'w-6 h-6',
}: {
  category: string;
  className?: string;
}) {
  const IconComponent = GOAL_ICONS[category] || Target;
  return <IconComponent className={className} />;
}

export function FrequencyIcon({
  frequency,
  className = 'w-4 h-4',
}: {
  frequency: string;
  className?: string;
}) {
  const IconComponent = FREQUENCY_ICONS[frequency] || Calendar;
  return <IconComponent className={className} />;
}

// Re-export Globe for use as fallback flag
export { Globe };
