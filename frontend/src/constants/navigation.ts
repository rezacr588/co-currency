import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Home,
  Wallet,
  ArrowLeftRight,
  Target,
  PieChart,
  RefreshCw,
  BarChart3,
  Bot,
  HelpCircle,
  LogIn,
  UserPlus,
  Plus,
} from 'lucide-react';
import { ROUTES } from './routes';
import type { TranslationKey } from '../i18n/translations';

export type NavItem = {
  id: string;
  to: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
};

export type NavSection = {
  id: string;
  titleKey: TranslationKey;
  items: NavItem[];
};

export type BottomNavItem = NavItem & {
  isCenter?: boolean;
};

export const AUTH_NAV_SECTIONS: NavSection[] = [
  {
    id: 'main',
    titleKey: 'main',
    items: [
      { id: 'dashboard', to: ROUTES.dashboard, labelKey: 'dashboard', icon: LayoutDashboard },
      { id: 'wallet', to: ROUTES.wallet, labelKey: 'wallet', icon: Wallet },
      { id: 'converter', to: ROUTES.appConverter, labelKey: 'converter', icon: ArrowLeftRight },
    ],
  },
  {
    id: 'finance',
    titleKey: 'finance',
    items: [
      { id: 'goals', to: ROUTES.goals, labelKey: 'financialGoals', icon: Target },
      { id: 'budgets', to: ROUTES.budgets, labelKey: 'budgets', icon: PieChart },
      { id: 'recurring', to: ROUTES.recurring, labelKey: 'recurring', icon: RefreshCw },
    ],
  },
  {
    id: 'insights',
    titleKey: 'insights',
    items: [
      { id: 'reports', to: ROUTES.reports, labelKey: 'reportsAndStats', icon: BarChart3 },
      { id: 'aiParser', to: ROUTES.walletAI, labelKey: 'aiParser', icon: Bot },
    ],
  },
];

export const AUTH_NAV_FOOTER_ITEMS: NavItem[] = [];

export const AUTH_NAV_ITEMS: NavItem[] = AUTH_NAV_SECTIONS.flatMap((section) => section.items);

export const AUTH_NAV_WITH_FOOTER: NavItem[] = [...AUTH_NAV_ITEMS, ...AUTH_NAV_FOOTER_ITEMS];

export const PUBLIC_NAV_ITEMS: NavItem[] = [
  { id: 'home', to: ROUTES.home, labelKey: 'home', icon: Home },
  { id: 'converter', to: ROUTES.converter, labelKey: 'converter', icon: ArrowLeftRight },
  { id: 'about', to: ROUTES.about, labelKey: 'aboutUs', icon: HelpCircle },
];

export const PUBLIC_AUTH_ITEMS: NavItem[] = [
  { id: 'login', to: ROUTES.login, labelKey: 'login', icon: LogIn },
  { id: 'register', to: ROUTES.register, labelKey: 'register', icon: UserPlus },
];

export const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { id: 'dashboard', to: ROUTES.dashboard, labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'wallet', to: ROUTES.wallet, labelKey: 'wallet', icon: Wallet },
  { id: 'walletAdd', to: ROUTES.walletAdd, labelKey: 'addTransaction', icon: Plus, isCenter: true },
  { id: 'goals', to: ROUTES.goals, labelKey: 'financialGoals', icon: Target },
  { id: 'reports', to: ROUTES.reports, labelKey: 'reportsAndStats', icon: BarChart3 },
];
