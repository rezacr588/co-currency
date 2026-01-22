import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { Home } from './pages/Home';
import { Reports } from './pages/Reports';
import { Subscriptions } from './pages/Subscriptions';
import { Badges } from './pages/Badges';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { SEOHead } from './components/SEOHead';
import { PublicLayout } from './components/layout/PublicLayout';
import { AuthenticatedLayout } from './components/layout/AuthenticatedLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen flex flex-col ${isRTL ? 'rtl' : 'ltr'} ${theme}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <SEOHead />
      <OfflineBanner />

      <Routes>
        {/* Public routes with header/footer */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Authenticated routes with sidebar layout */}
        <Route element={<AuthenticatedLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/wallet/add" element={<TransactionForm />} />
          <Route path="/wallet/history" element={<TransactionHistoryPage />} />
          <Route path="/wallet/convert" element={<WalletConvert />} />
          <Route path="/wallet/ai" element={<AIReceiptParser />} />
          <Route path="/goals" element={<GoalsList />} />
          <Route path="/budgets" element={<BudgetList />} />
          <Route path="/recurring" element={<RecurringList />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
          <Route path="/badges" element={<Badges />} />
        </Route>
      </Routes>
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
                <ToastProvider>
                  <AppContent />
                  <ToastContainer />
                </ToastProvider>
              </AuthProvider>
            </LanguageProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

export default App;