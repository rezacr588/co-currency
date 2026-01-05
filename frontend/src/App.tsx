import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Container } from './components/layout';
import { Converter } from './components/features/Converter';
import { RatesGrid } from './components/features/RatesGrid';
import { QuickConvert } from './components/features/QuickConvert';
import { Historical } from './components/features/Historical';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { LanguageToggle } from './components/ui/LanguageToggle';
import { ThemeToggle } from './components/ui/ThemeToggle';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function Header() {
  const { t } = useLanguage();

  return (
    <header className="relative py-8 sm:py-12">
      <Container>
        <div className="flex flex-col items-center gap-6">
          {/* Logo/Title */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-light tracking-tight text-gradient">
              {t('appTitle')}
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm sm:text-base font-light tracking-wide">
              {t('appSubtitle')}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
            <ThemeToggle />
          </div>
        </div>
      </Container>
    </header>
  );
}

function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-8 mt-auto">
      <Container>
        <div className="text-center space-y-2">
          <p className="text-xs text-slate-400 dark:text-slate-500 font-light tracking-wide">
            {t('footerText')}{' '}
            <a
              href="https://www.frankfurter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
            >
              Frankfurter API
            </a>
          </p>
          <p className="text-xs text-slate-300 dark:text-slate-600">
            {t('ratesUpdatedDaily')}
          </p>
        </div>
      </Container>
    </footer>
  );
}

function AppContent() {
  const { language } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col ${language === 'fa' ? 'rtl' : 'ltr'} ${theme}`} dir={language === 'fa' ? 'rtl' : 'ltr'}>
      <Header />

      <main className="flex-1 py-4 sm:py-8">
        <Container>
          <div className="space-y-8 sm:space-y-12">
            {/* Main Converter */}
            <section className="animate-fade-in">
              <Converter />
            </section>

            {/* Quick Conversions */}
            <section className="animate-fade-in stagger-1" style={{ opacity: 0, animationDelay: '0.1s' }}>
              <QuickConvert />
            </section>

            {/* Exchange Rates Grid */}
            <section className="animate-fade-in stagger-2" style={{ opacity: 0, animationDelay: '0.2s' }}>
              <RatesGrid />
            </section>

            {/* Historical Rates */}
            <section className="animate-fade-in stagger-3" style={{ opacity: 0, animationDelay: '0.3s' }}>
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AppContent />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
