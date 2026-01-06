import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Container } from './components/layout';
import { Converter } from './components/features/Converter';
import { RatesGrid } from './components/features/RatesGrid';
import { QuickConvert } from './components/features/QuickConvert';
import { Historical } from './components/features/Historical';
import { AboutUs } from './components/features/AboutUs';
import { NotFound } from './components/features/NotFound';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { HamburgerMenu } from './components/ui/HamburgerMenu';

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

function Header() {
  const { t, isRTL } = useLanguage();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
      <Container>
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group">
            <div className="w-9 h-9 rounded-xl shadow-lg shadow-indigo-500/25 group-hover:shadow-indigo-500/40 transition-shadow overflow-hidden">
              <img src="/logo.svg" alt="CoFinance Logo" className="w-full h-full" loading="eager" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                {t('appTitle')}
              </h1>
            </div>
          </Link>

          {/* Navigation */}
          <div className={`flex items-center gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t('home')}
              </Link>
              <Link
                to="/about"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === '/about'
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t('aboutUs')}
              </Link>
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
            className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
          >
            Frankfurter API
          </a>
          {' · '}{t('ratesUpdatedDaily')}
        </p>
      </Container>
    </footer>
  );
}

function HomePage() {
  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
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
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
