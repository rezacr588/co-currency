import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { Container } from './components/layout';
import { Converter } from './components/features/Converter';
import { RatesGrid } from './components/features/RatesGrid';
import { QuickConvert } from './components/features/QuickConvert';
import { Historical } from './components/features/Historical';
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
    en: 'Currency Converter - Real-Time Exchange Rates | Convert USD, EUR, GBP & More',
    fa: 'مبدل ارز - نرخ ارز لحظه‌ای | تبدیل دلار، یورو، پوند و بیشتر',
    ar: 'محول العملات - أسعار الصرف الفورية | تحويل USD و EUR و GBP والمزيد',
    tr: 'Döviz Çevirici - Anlık Döviz Kurları | USD, EUR, GBP ve Daha Fazlası',
  };

  const descriptions: Record<string, string> = {
    en: 'Free online currency converter with real-time exchange rates. Convert between USD, EUR, GBP, JPY, IRR and 30+ world currencies. Fast, accurate, and easy to use.',
    fa: 'مبدل ارز آنلاین رایگان با نرخ ارز لحظه‌ای. تبدیل بین دلار، یورو، پوند، ین، ریال و بیش از ۳۰ ارز جهانی. سریع، دقیق و آسان.',
    ar: 'محول عملات مجاني عبر الإنترنت مع أسعار صرف فورية. تحويل بين USD و EUR و GBP و JPY و IRR وأكثر من 30 عملة عالمية.',
    tr: 'Anlık döviz kurları ile ücretsiz online döviz çevirici. USD, EUR, GBP, JPY, IRR ve 30+ dünya para birimi arasında dönüştürün.',
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
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
      <Container>
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-white hidden sm:block">
              {t('appTitle')}
            </h1>
          </div>

          {/* Menu */}
          <HamburgerMenu />
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

function AppContent() {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col ${isRTL ? 'rtl' : 'ltr'} ${theme}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead />
      <Header />

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

      <Footer />
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;
