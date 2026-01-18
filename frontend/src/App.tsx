import { useState, useRef, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Container } from './components/layout';
import { Converter } from './components/features/Converter';
import { RatesGrid } from './components/features/RatesGrid';
import { QuickConvert } from './components/features/QuickConvert';
import { Historical } from './components/features/Historical';
import { AboutUs } from './components/features/AboutUs';
import { NotFound } from './components/features/NotFound';
import { Dashboard } from './components/features/Dashboard';
import {
  Wallet,
  TransactionForm,
  TransactionHistoryPage,
  WalletConvert,
  AIReceiptParser,
} from './components/features/Wallet';
import { GoalsList } from './components/features/Goals';
import { BudgetList } from './components/features/Budgets';
import { RecurringList } from './components/features/Recurring';
import { Login, Register, ForgotPassword, ResetPassword } from './pages';
import { Reports } from './pages/Reports';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HamburgerMenu } from './components/ui/HamburgerMenu';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Card, CardContent } from './components/ui/Card';
import { Button } from './components/ui/Button';
import { api } from './api/client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function SEOHead() {
  const { language } = useLanguage();

  const titles: Record<string, string> = {
    en: 'CoFinance - Real-Time Currency Converter | Exchange Rates for USD, EUR, GBP & More',
    fa: 'کوفایننس - مبدل ارز لحظه‌ای | نرخ ارز دلار، یورو، پوند و بیشتر',
    ar: 'كوفايننس - محول العملات الفوري | أسعار صرف USD و EUR و GBP والمزيد',
    tr: 'CoFinance - Anlık Döviz Çevirici | USD, EUR, GBP ve Daha Fazlası',
  };

  const descriptions: Record<string, string> = {
    en: 'CoFinance - Free online currency converter with real-time exchange rates. Convert between USD, EUR, GBP, JPY, IRR and 160+ world currencies. Fast, accurate, and easy to use.',
    fa: 'کوفایننس - مبدل ارز آنلاین رایگان با نرخ ارز لحظه‌ای. تبدیل بین دلار، یورو، پوند، ین، ریال و بیش از ۱۶۰ ارز جهانی.',
    ar: 'كوفايننس - محول عملات مجاني مع أسعار صرف فورية. تحويل بين أكثر من 160 عملة عالمية.',
    tr: 'CoFinance - Anlık döviz kurları ile ücretsiz online döviz çevirici. 160+ dünya para birimi arasında dönüştürün.',
  };

  return (
    <Helmet>
      <html lang={language} dir={language === 'fa' || language === 'ar' ? 'rtl' : 'ltr'} />
      <title>{titles[language] || titles.en}</title>
      <meta name="description" content={descriptions[language] || descriptions.en} />
      <meta property="og:title" content={titles[language] || titles.en} />
      <meta property="og:description" content={descriptions[language] || descriptions.en} />
      <meta property="og:locale" content={language === 'fa' ? 'fa_IR' : language === 'ar' ? 'ar_SA' : language === 'tr' ? 'tr_TR' : 'en_US'} />
    </Helmet>
  );
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function BalanceDisplay() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const balance = summary?.total_balance_usd ?? 0;
  const hasBalance = !isLoading && !error && summary;

  return (
    <Link
      to="/wallet"
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/30 hover:border-primary-300 dark:hover:border-primary-600 transition-all group"
      title={t('totalBalance')}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary-800 dark:bg-primary-700">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium text-primary-700/70 dark:text-primary-400/70 uppercase tracking-wider leading-none">
          {t('balance')}
        </span>
        {isLoading ? (
          <span className="text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">---</span>
        ) : error ? (
          <span className="text-sm font-bold text-rose-500 dark:text-rose-400">--</span>
        ) : (
          <span className={`text-sm font-bold leading-tight ${
            hasBalance && balance > 0
              ? 'text-green-600 dark:text-green-400'
              : hasBalance && balance < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-600 dark:text-slate-400'
          }`}>
            {formatCompactCurrency(balance)}
          </span>
        )}
      </div>
    </Link>
  );
}

function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t, isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = [
    { to: '/dashboard', label: t('dashboard'), icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { to: '/wallet', label: t('wallet'), icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
    { to: '/goals', label: t('financialGoals'), icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
    { to: '/budgets', label: t('budgets'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { to: '/recurring', label: t('recurring'), icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { to: '/reports', label: t('reportsAndStats'), icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="hidden md:inline">{user?.name}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 ${isRTL ? 'left-0' : 'right-0'}`}>
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('navigation')}
            </p>
            {menuItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${
                  location.pathname === item.to || location.pathname.startsWith(item.to + '/')
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {item.label}
              </Link>
            ))}
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-rose-600 dark:text-rose-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Header() {
  const { t, isRTL } = useLanguage();
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
      <Container>
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group">
            <div className="w-9 h-9 rounded-md shadow-md overflow-hidden">
              <img src="/logo.svg" alt="CoFinance Logo" className="w-full h-full" loading="eager" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-primary-800 dark:text-primary-300">
                {t('appTitle')}
              </h1>
            </div>
          </Link>

          {/* Navigation */}
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <nav className="hidden sm:flex items-center gap-1">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/dashboard"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/dashboard'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('dashboard')}
                  </Link>
                  <Link
                    to="/"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('converter')}
                  </Link>
                  <Link
                    to="/about"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/about'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('aboutUs')}
                  </Link>
                  <BalanceDisplay />
                  <UserDropdown />
                </>
              ) : (
                <>
                  <Link
                    to="/"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('home')}
                  </Link>
                  <Link
                    to="/about"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/about'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('aboutUs')}
                  </Link>
                  <Link
                    to="/login"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === '/login'
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t('login')}
                  </Link>
                  <Link
                    to="/register"
                    className="px-3 py-1.5 rounded-md text-sm font-medium bg-primary-800 text-white hover:bg-primary-700 transition-colors"
                  >
                    {t('register')}
                  </Link>
                </>
              )}
            </nav>

            {/* Menu */}
            <HamburgerMenu />
          </div>
        </div>
      </Container>
    </header>
  );
}

function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-4 mt-auto border-t border-slate-200/50 dark:border-slate-800/50">
      <Container>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          {t('footerText')}{' '}
          <a
            href="https://www.frankfurter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            Frankfurter API
          </a>
          {' · '}{t('ratesUpdatedDaily')}
        </p>
      </Container>
    </footer>
  );
}

// Hero Section - Main value proposition
function HeroSection() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#2d4a6f] to-[#1e3a5f] rounded-2xl">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#d4af37]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#d4af37]/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative px-6 py-16 sm:py-20 md:py-24 text-center">
        <div className="max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 rounded-full bg-white/10 border border-white/20 text-white/90 text-sm font-medium backdrop-blur-sm">
            <svg className="w-4 h-4 text-[#d4af37]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{t('statsFreeLabel')}</span>
          </div>

          {/* Main headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            {t('heroTitle')}
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t('heroSubtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
            <Link to="/register">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto bg-[#d4af37] hover:bg-[#c9a432] text-[#1e3a5f] font-semibold px-8 py-4 text-lg shadow-lg shadow-[#d4af37]/25 border-0"
              >
                {t('heroCtaPrimary')}
                <svg className="w-5 h-5 ms-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
            </Link>
            <a href="#converter">
              <Button
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/30 px-8 py-4 text-lg backdrop-blur-sm"
              >
                {t('heroCtaSecondary')}
              </Button>
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-6 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('trustSecure')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('trustPrivacy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{t('trustOpen')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Stats Section - Social proof with numbers
function StatsSection() {
  const { t } = useLanguage();

  const stats = [
    { value: t('statsCurrencies'), label: t('statsCurrenciesLabel'), icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { value: t('statsRealTime'), label: t('statsRealTimeLabel'), icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
    { value: t('statsFree'), label: t('statsFreeLabel'), icon: 'M5 13l4 4L19 7' },
    { value: t('statsLanguages'), label: t('statsLanguagesLabel'), icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
  ];

  return (
    <section className="py-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="text-center p-6 hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1e3a5f]/10 dark:bg-[#d4af37]/10 mb-4">
                <svg className="w-6 h-6 text-[#1e3a5f] dark:text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                </svg>
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-[#1e3a5f] dark:text-[#d4af37] mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {stat.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Features Grid - Key features with icons
function FeaturesSection() {
  const { t } = useLanguage();

  const features = [
    {
      title: t('featureWalletTitle'),
      description: t('featureWalletDesc'),
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      color: 'bg-blue-500',
    },
    {
      title: t('featureGoalsTitle'),
      description: t('featureGoalsDesc'),
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-500',
    },
    {
      title: t('featureBudgetsTitle'),
      description: t('featureBudgetsDesc'),
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      color: 'bg-purple-500',
    },
    {
      title: t('featureRecurringTitle'),
      description: t('featureRecurringDesc'),
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      color: 'bg-orange-500',
    },
    {
      title: t('featureReportsTitle'),
      description: t('featureReportsDesc'),
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'bg-cyan-500',
    },
    {
      title: t('featureAITitle'),
      description: t('featureAIDesc'),
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      color: 'bg-pink-500',
    },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('featuresTitle')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          {t('featuresSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <CardContent className="p-6">
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${feature.color} mb-4 group-hover:scale-110 transition-transform`}>
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={feature.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                {feature.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// How It Works - Simple 3-step process
function HowItWorksSection() {
  const { t } = useLanguage();

  const steps = [
    { number: '1', title: t('step1Title'), description: t('step1Desc'), icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { number: '2', title: t('step2Title'), description: t('step2Desc'), icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { number: '3', title: t('step3Title'), description: t('step3Desc'), icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('howItWorksTitle')}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t('howItWorksSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, index) => (
          <div key={index} className="relative text-center">
            {/* Connector line */}
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute top-16 left-1/2 w-full h-0.5 bg-gradient-to-r from-[#1e3a5f] to-[#d4af37] dark:from-[#d4af37] dark:to-[#1e3a5f]" />
            )}

            {/* Step number */}
            <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#2d4a6f] dark:from-[#d4af37] dark:to-[#c9a432] text-white dark:text-[#1e3a5f] text-2xl font-bold mb-6 shadow-lg">
              {step.number}
            </div>

            {/* Icon */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 mb-4">
              <svg className="w-6 h-6 text-[#1e3a5f] dark:text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
              </svg>
            </div>

            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              {step.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// Trust Indicators Section
function TrustSection() {
  const { t } = useLanguage();

  const trustItems = [
    { title: t('trustSecure'), description: t('trustSecureDesc'), icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
    { title: t('trustPrivacy'), description: t('trustPrivacyDesc'), icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
    { title: t('trustOpen'), description: t('trustOpenDesc'), icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">
          {t('trustTitle')}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {trustItems.map((item, index) => (
          <Card key={index} className="border-2 border-[#1e3a5f]/10 dark:border-[#d4af37]/20 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#1e3a5f]/10 dark:bg-[#d4af37]/10 mb-4">
                <svg className="w-7 h-7 text-[#1e3a5f] dark:text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                {item.title}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// Final CTA Section
function FinalCTA() {
  const { t } = useLanguage();

  return (
    <section className="py-12">
      <Card className="overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#2d4a6f] to-[#1e3a5f] border-0">
        <CardContent className="py-12 px-6 text-center relative">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-[#d4af37]/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-[#d4af37]/20 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              {t('finalCtaTitle')}
            </h2>
            <p className="text-white/80 mb-8 text-lg">
              {t('finalCtaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/register">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto bg-[#d4af37] hover:bg-[#c9a432] text-[#1e3a5f] font-semibold px-8 py-4 text-lg shadow-lg shadow-[#d4af37]/25 border-0"
                >
                  {t('heroCtaPrimary')}
                  <svg className="w-5 h-5 ms-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border-white/30 px-8 py-4 text-lg backdrop-blur-sm"
                >
                  {t('login')}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        {/* Marketing sections for non-authenticated users */}
        {!isAuthenticated && (
          <div className="space-y-4">
            {/* Hero Section */}
            <HeroSection />

            {/* Stats Section */}
            <StatsSection />

            {/* Features Section */}
            <FeaturesSection />

            {/* How It Works Section */}
            <HowItWorksSection />

            {/* Trust Indicators Section */}
            <TrustSection />
          </div>
        )}

        {/* Converter Section - with anchor for navigation */}
        <div id="converter" className={!isAuthenticated ? 'pt-8' : ''}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
            {/* Main Converter - Centered and prominent */}
            <section className="lg:col-span-7 xl:col-span-6 xl:col-start-1">
              <Converter />
            </section>

            {/* Quick Conversions - Side panel on large screens */}
            <section className="lg:col-span-5 xl:col-span-6">
              <QuickConvert />
            </section>

            {/* Exchange Rates Grid - Full width */}
            <section className="lg:col-span-12">
              <RatesGrid />
            </section>

            {/* Historical Rates - Full width */}
            <section className="lg:col-span-12">
              <Historical />
            </section>
          </div>
        </div>

        {/* Final CTA for non-authenticated users */}
        {!isAuthenticated && <FinalCTA />}
      </Container>
    </main>
  );
}

function AppContent() {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col ${isRTL ? 'rtl' : 'ltr'} ${theme}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead />
      <Header />

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet"
          element={
            <ProtectedRoute>
              <Wallet />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet/add"
          element={
            <ProtectedRoute>
              <TransactionForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet/history"
          element={
            <ProtectedRoute>
              <TransactionHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet/convert"
          element={
            <ProtectedRoute>
              <WalletConvert />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wallet/ai"
          element={
            <ProtectedRoute>
              <AIReceiptParser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/goals"
          element={
            <ProtectedRoute>
              <GoalsList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/budgets"
          element={
            <ProtectedRoute>
              <BudgetList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recurring"
          element={
            <ProtectedRoute>
              <RecurringList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProvider>
                <AppContent />
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
