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

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
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
