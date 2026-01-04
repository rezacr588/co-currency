import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Container } from './components/layout';
import { Converter } from './components/features/Converter';
import { RatesGrid } from './components/features/RatesGrid';
import { QuickConvert } from './components/features/QuickConvert';
import { Historical } from './components/features/Historical';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { LanguageToggle } from './components/ui/LanguageToggle';

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
    <header className="py-6 sm:py-8 border-b border-slate-800">
      <Container>
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-gradient mb-2">
              {t('appTitle')}
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              {t('appSubtitle')}
            </p>
          </div>
          <LanguageToggle />
        </div>
      </Container>
    </header>
  );
}

function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="py-6 border-t border-slate-800 mt-auto">
      <Container>
        <p className="text-center text-sm text-slate-500">
          {t('footerText')}{' '}
          <a
            href="https://www.frankfurter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300"
          >
            Frankfurter API
          </a>
          {' '}| {t('ratesUpdatedDaily')}
        </p>
      </Container>
    </footer>
  );
}

function AppContent() {
  const { language } = useLanguage();

  return (
    <div className={`min-h-screen flex flex-col ${language === 'fa' ? 'rtl' : 'ltr'}`} dir={language === 'fa' ? 'rtl' : 'ltr'}>
      <Header />

      <main className="flex-1 py-6 sm:py-8">
        <Container>
          <div className="space-y-6 sm:space-y-8">
            {/* Main Converter */}
            <section>
              <Converter />
            </section>

            {/* Quick Conversions */}
            <section>
              <QuickConvert />
            </section>

            {/* Exchange Rates Grid */}
            <section>
              <RatesGrid />
            </section>

            {/* Historical Rates */}
            <section>
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
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
