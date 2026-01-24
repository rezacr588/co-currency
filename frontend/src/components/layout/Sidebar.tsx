import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { formatCurrency } from '../../utils/format';
import {
  LayoutDashboard,
  Wallet,
  Target,
  PieChart,
  RefreshCw,
  BarChart3,
  Bot,
  ArrowLeftRight,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Coins,
} from 'lucide-react';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed?: boolean;
  badge?: number | string;
  badgeColor?: string;
}

function NavItem({ to, icon, label, collapsed, badge, badgeColor = 'bg-primary-500' }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
          isActive
            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
        }`
      }
    >
      <span className="flex-shrink-0 w-5 h-5">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge !== undefined && (
            <span className={`${badgeColor} text-white text-xs font-medium px-2 py-0.5 rounded-full`}>
              {badge}
            </span>
          )}
        </>
      )}
      {collapsed && badge !== undefined && (
        <span className={`absolute -top-1 -right-1 ${badgeColor} text-white text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function NavSection({ title, children, collapsed }: { title: string; children: React.ReactNode; collapsed?: boolean }) {
  if (collapsed) {
    return <div className="space-y-1 py-2">{children}</div>;
  }
  return (
    <div className="py-2">
      <h3 className="px-3 mb-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const { t } = useLanguage();
  const { user, logout } = useAuth();

  // Fetch summary for balance display
  const { data: summary } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000,
  });

  // Fetch recurring for badge
  const { data: recurringData } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.recurring.list(),
    staleTime: 60 * 1000,
  });

  const recurring = recurringData?.recurring_transactions || [];
  const dueRecurring = recurring.filter(r => {
    if (!r.is_active) return false;
    const nextDate = new Date(r.next_execution);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return nextDate <= today;
  });

  const totalBalanceUSD = summary?.total_balance_usd || 0;

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-40 ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Logo & Brand */}
      <div className={`flex items-center h-16 px-4 border-b border-slate-200 dark:border-slate-800 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Coins className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 dark:text-white truncate">CoFinance</h1>
          </div>
        )}
      </div>

      {/* User Profile Section */}
      <div className={`p-4 border-b border-slate-200 dark:border-slate-800 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-800 dark:text-white truncate">{user?.name}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                {formatCurrency(totalBalanceUSD, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavSection title={t('main')} collapsed={collapsed}>
          <NavItem
            to="/dashboard"
            icon={<LayoutDashboard className="w-5 h-5" />}
            label={t('dashboard')}
            collapsed={collapsed}
          />
          <NavItem
            to="/wallet"
            icon={<Wallet className="w-5 h-5" />}
            label={t('wallet')}
            collapsed={collapsed}
          />
          <NavItem
            to="/converter"
            icon={<ArrowLeftRight className="w-5 h-5" />}
            label={t('converter')}
            collapsed={collapsed}
          />
        </NavSection>

        <NavSection title={t('finance')} collapsed={collapsed}>
          <NavItem
            to="/goals"
            icon={<Target className="w-5 h-5" />}
            label={t('financialGoals')}
            collapsed={collapsed}
          />
          <NavItem
            to="/budgets"
            icon={<PieChart className="w-5 h-5" />}
            label={t('budgets')}
            collapsed={collapsed}
          />
          <NavItem
            to="/recurring"
            icon={<RefreshCw className="w-5 h-5" />}
            label={t('recurring')}
            collapsed={collapsed}
            badge={dueRecurring.length > 0 ? dueRecurring.length : undefined}
            badgeColor="bg-amber-500"
          />
        </NavSection>

        <NavSection title={t('insights')} collapsed={collapsed}>
          <NavItem
            to="/reports"
            icon={<BarChart3 className="w-5 h-5" />}
            label={t('reportsAndStats')}
            collapsed={collapsed}
          />
          <NavItem
            to="/wallet/ai"
            icon={<Bot className="w-5 h-5" />}
            label={t('aiParser')}
            collapsed={collapsed}
          />
        </NavSection>
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <NavItem
          to="/about"
          icon={<HelpCircle className="w-5 h-5" />}
          label={t('aboutUs')}
          collapsed={collapsed}
        />
        <button
          onClick={logout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all duration-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>{t('logout')}</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      {onToggle && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 shadow-sm hover:shadow transition-all"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}
    </aside>
  );
}
