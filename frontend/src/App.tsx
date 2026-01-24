import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ToastContainer } from './components/ui/ToastContainer';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { SEOHead } from './components/SEOHead';
import { PublicLayout } from './components/layout/PublicLayout';
import { AuthenticatedLayout } from './components/layout/AuthenticatedLayout';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

// Lazy load pages and features
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Login = lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Register = lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const GitHubCallback = lazy(() => import('./pages/GitHubCallback').then(m => ({ default: m.GitHubCallback })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Subscriptions = lazy(() => import('./pages/Subscriptions').then(m => ({ default: m.Subscriptions })));
const Badges = lazy(() => import('./pages/Badges').then(m => ({ default: m.Badges })));
const Converter = lazy(() => import('./pages/Converter').then(m => ({ default: m.Converter })));
const AIChat = lazy(() => import('./pages/AIChat'));

const AboutUs = lazy(() => import('./components/features/AboutUs').then(m => ({ default: m.AboutUs })));
const NotFound = lazy(() => import('./components/features/NotFound').then(m => ({ default: m.NotFound })));
const Dashboard = lazy(() => import('./components/features/Dashboard').then(m => ({ default: m.Dashboard })));
const GoalsList = lazy(() => import('./components/features/Goals').then(m => ({ default: m.GoalsList })));
const BudgetList = lazy(() => import('./components/features/Budgets').then(m => ({ default: m.BudgetList })));
const RecurringList = lazy(() => import('./components/features/Recurring').then(m => ({ default: m.RecurringList })));

// Wallet features
const Wallet = lazy(() => import('./components/features/Wallet').then(m => ({ default: m.Wallet })));
const TransactionForm = lazy(() => import('./components/features/Wallet').then(m => ({ default: m.TransactionForm })));
const TransactionHistoryPage = lazy(() => import('./components/features/Wallet').then(m => ({ default: m.TransactionHistoryPage })));
const WalletConvert = lazy(() => import('./components/features/Wallet').then(m => ({ default: m.WalletConvert })));
const AIReceiptParser = lazy(() => import('./components/features/Wallet').then(m => ({ default: m.AIReceiptParser })));

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

      <Suspense fallback={
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <Routes>
          {/* Public routes with header/footer */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/github/callback" element={<GitHubCallback />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Authenticated routes with sidebar layout */}
          <Route element={<AuthenticatedLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/converter" element={<Converter />} />
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
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/ai-chat/:conversationId" element={<AIChat />} />
          </Route>
        </Routes>
      </Suspense>
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