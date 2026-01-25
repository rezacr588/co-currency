import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Language } from '../../i18n/translations';
import { api } from '../../api';
import { formatCompactCurrency } from '../../utils/format';
import { AUTH_NAV_WITH_FOOTER, PUBLIC_AUTH_ITEMS, PUBLIC_NAV_ITEMS, type NavItem } from '../../constants/navigation';
import { ROUTES } from '../../constants/routes';

const LANGUAGES: { code: Language; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'fa', name: 'Persian', native: 'فارسی' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'tr', name: 'Turkish', native: 'Türkçe' },
];

export function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const authNavItems = AUTH_NAV_WITH_FOOTER;
  const publicNavItems = [...PUBLIC_NAV_ITEMS, ...PUBLIC_AUTH_ITEMS];

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive =
      item.to === ROUTES.home
        ? location.pathname === ROUTES.home
        : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
    return (
      <Link
        key={item.id}
        to={item.to}
        onClick={() => setIsOpen(false)}
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
        }`}
        role="menuitem"
      >
        <Icon className="w-4 h-4" />
        {t(item.labelKey)}
      </Link>
    );
  };

  // Fetch wallet summary for balance display
  const { data: walletSummary, isLoading: balanceLoading } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
  });

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-600/30 touch-target"
        aria-label={isOpen ? t('closeMenu') : t('openMenu')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-5 h-4 flex flex-col justify-between">
          <span className={`block h-0.5 w-5 bg-slate-600 dark:bg-slate-300 rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block h-0.5 w-5 bg-slate-600 dark:bg-slate-300 rounded-full transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`} />
          <span className={`block h-0.5 w-5 bg-slate-600 dark:bg-slate-300 rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute top-full mt-2 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 overflow-hidden z-50 animate-fade-in ${isRTL ? 'left-0' : 'right-0'}`}
          role="menu"
        >
          {/* Navigation Links - Mobile Only */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50 sm:hidden">
            <p className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('menu')}
            </p>
            <div className="mt-1 space-y-0.5">
              {(isAuthenticated ? authNavItems : publicNavItems).map(renderNavItem)}
            </div>
          </div>

          {/* User Section - Mobile Only */}
          {isAuthenticated && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-700/50 sm:hidden">
              <p className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {t('account')}
              </p>
              <div className="mt-1 space-y-0.5">
                <div className="px-2 py-2 text-sm text-slate-700 dark:text-slate-200">
                  {user?.name}
                </div>
                {/* Balance Display for Mobile */}
                <Link
                  to={ROUTES.wallet}
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 rounded-md bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/30"
                  role="menuitem"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary-800 dark:bg-primary-700">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-medium text-primary-700/70 dark:text-primary-400/70 uppercase tracking-wider">
                      {t('totalBalance')}
                    </span>
                    {balanceLoading ? (
                      <span className="text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">---</span>
                    ) : (
                      <span className={`text-sm font-bold ${(walletSummary?.total_balance_usd ?? 0) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : (walletSummary?.total_balance_usd ?? 0) < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}>
                        {formatCompactCurrency(walletSummary?.total_balance_usd ?? 0, 'USD')}
                      </span>
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-rose-600 dark:text-rose-400 transition-colors"
                  role="menuitem"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {t('logout')}
                </button>
              </div>
            </div>
          )}

          {/* Language Section */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
            <p className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('language')}
            </p>
            <div className="mt-1 space-y-0.5">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${language === lang.code
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                    }`}
                  role="menuitemradio"
                  aria-checked={language === lang.code}
                >
                  <span>{lang.native}</span>
                  {language === lang.code && (
                    <svg className="w-4 h-4 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Toggle */}
          <div className="p-2">
            <button
              onClick={() => {
                toggleTheme();
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors"
              role="menuitem"
            >
              <span className="flex items-center gap-2">
                {theme === 'dark' ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {t('toggleTheme')}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 capitalize">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
