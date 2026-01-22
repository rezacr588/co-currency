import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Container } from './Container';
import { BalanceDisplay } from './BalanceDisplay';
import { UserDropdown } from './UserDropdown';
import { HamburgerMenu } from '../ui/HamburgerMenu';

export function Header() {
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === '/dashboard'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {t('dashboard')}
                  </Link>
                  <Link
                    to="/"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === '/'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {t('converter')}
                  </Link>
                  <Link
                    to="/about"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === '/about'
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
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === '/'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {t('home')}
                  </Link>
                  <Link
                    to="/about"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === '/about'
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    {t('aboutUs')}
                  </Link>
                  <Link
                    to="/login"
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname === '/login'
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
