import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { Container } from './Container';
import { BalanceDisplay } from './BalanceDisplay';
import { UserDropdown } from './UserDropdown';
import { HamburgerMenu } from '../ui/HamburgerMenu';
import { ROUTES } from '../../constants/routes';
import { AUTH_NAV_WITH_FOOTER, PUBLIC_AUTH_ITEMS, PUBLIC_NAV_ITEMS } from '../../constants/navigation';

export function Header() {
  const { t, isRTL } = useLanguage();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const authNavLookup = new Map(AUTH_NAV_WITH_FOOTER.map((item) => [item.id, item]));
  const authHeaderNav = ['dashboard', 'converter']
    .map((id) => authNavLookup.get(id))
    .filter(Boolean);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200/50 dark:border-slate-800/50">
      <Container>
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to={isAuthenticated ? ROUTES.dashboard : ROUTES.home} className="flex items-center gap-2.5 hover:opacity-90 transition-opacity group">
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
                  {authHeaderNav.map((item) => {
                    if (!item) return null;
                    return (
                      <Link
                        key={item.id}
                        to={item.to}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          location.pathname === item.to
                            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {t(item.labelKey)}
                      </Link>
                    );
                  })}
                  <BalanceDisplay />
                  <UserDropdown />
                </>
              ) : (
                <>
                  {PUBLIC_NAV_ITEMS.map((item) => (
                    <Link
                      key={item.id}
                      to={item.to}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        location.pathname === item.to
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {t(item.labelKey)}
                    </Link>
                  ))}
                  {PUBLIC_AUTH_ITEMS.map((item) => (
                    <Link
                      key={item.id}
                      to={item.to}
                      className={
                        item.id === 'register'
                          ? 'px-3 py-1.5 rounded-md text-sm font-medium bg-primary-800 text-white hover:bg-primary-700 transition-colors'
                          : `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              location.pathname === item.to
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`
                      }
                    >
                      {t(item.labelKey)}
                    </Link>
                  ))}
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
