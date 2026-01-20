import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { formatCurrency } from '../../utils/format';
import {
  Menu,
  X,
  LayoutDashboard,
  Wallet,
  Target,
  PieChart,
  RefreshCw,
  BarChart3,
  Bot,
  ArrowLeftRight,
  HelpCircle,
  LogOut,
  Sun,
  Moon,
  Globe,
  ChevronRight,
  Coins,
} from 'lucide-react';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'fa', name: 'فارسی', flag: '🇮🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

export function MobileHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Fetch summary for balance display
  const { data: summary } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000,
  });

  const totalBalanceUSD = summary?.total_balance_usd || 0;

  // Close menu on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowLanguages(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowLanguages(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleNavClick = () => {
    setIsOpen(false);
    setShowLanguages(false);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: t('dashboard') },
    { to: '/wallet', icon: Wallet, label: t('wallet') },
    { to: '/', icon: ArrowLeftRight, label: t('converter') },
    { to: '/goals', icon: Target, label: t('financialGoals') },
    { to: '/budgets', icon: PieChart, label: t('budgets') },
    { to: '/recurring', icon: RefreshCw, label: t('recurring') },
    { to: '/reports', icon: BarChart3, label: t('reportsAndStats') },
    { to: '/wallet/ai', icon: Bot, label: t('aiParser') },
    { to: '/about', icon: HelpCircle, label: t('aboutUs') },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-50">
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Coins className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-slate-800 dark:text-white">CoFinance</span>
        </div>

        {/* Balance (if available) */}
        <div className="flex-1 flex justify-center">
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalBalanceUSD, 'USD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Menu Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={isOpen ? t('closeMenu') : t('openMenu')}
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-16 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto animate-fade-in"
        >
          {/* User Info */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <span className="text-white font-semibold">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="font-medium text-slate-800 dark:text-white">{user?.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="p-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Settings Section */}
          <div className="p-2 border-t border-slate-100 dark:border-slate-800">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              <span>{theme === 'dark' ? t('lightMode') : t('darkMode')}</span>
            </button>

            {/* Language Selector */}
            <button
              onClick={() => setShowLanguages(!showLanguages)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Globe className="w-5 h-5" />
              <span className="flex-1 text-left">{t('language')}</span>
              <ChevronRight className={`w-4 h-4 transition-transform ${showLanguages ? 'rotate-90' : ''}`} />
            </button>

            {/* Language Options */}
            {showLanguages && (
              <div className="ml-8 mt-1 space-y-1">
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code as 'en' | 'fa' | 'ar' | 'tr');
                      setShowLanguages(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
                      language === lang.code
                        ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
