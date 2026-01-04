import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Container } from './components/layout';
import { Converter } from './components/features/Converter';
import { RatesGrid } from './components/features/RatesGrid';
import { QuickConvert } from './components/features/QuickConvert';
import { Historical } from './components/features/Historical';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function Header() {
  return (
    <header className="py-8 border-b border-slate-800">
      <Container>
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gradient mb-2">
            Currency Converter
          </h1>
          <p className="text-slate-400">
            Real-time exchange rates powered by Frankfurter API
          </p>
        </div>
      </Container>
    </header>
  );
}

function Footer() {
  return (
    <footer className="py-6 border-t border-slate-800 mt-auto">
      <Container>
        <p className="text-center text-sm text-slate-500">
          Exchange rates provided by{' '}
          <a
            href="https://www.frankfurter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300"
          >
            Frankfurter API
          </a>
          {' '}| Rates are updated daily
        </p>
      </Container>
    </footer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex flex-col">
        <Header />

        <main className="flex-1 py-8">
          <Container>
            <div className="space-y-8">
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
    </QueryClientProvider>
  );
}

export default App;
