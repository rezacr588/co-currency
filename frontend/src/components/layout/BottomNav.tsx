import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { BOTTOM_NAV_ITEMS } from '../../constants/navigation';
import { ROUTES } from '../../constants/routes';

interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    ariaLabel: string;
    isActive?: boolean;
}

function NavItem({ to, icon, ariaLabel, isActive }: NavItemProps) {
    return (
        <NavLink
            to={to}
            aria-label={ariaLabel}
            className={`relative flex items-center justify-center flex-1 h-full transition-all duration-200 ${isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-slate-400 dark:text-slate-500 active:text-slate-600 dark:active:text-slate-300'
                }`}
        >
            <span className={`transition-transform duration-200 ${isActive ? 'scale-110' : 'active:scale-90'}`}>
                {icon}
            </span>
            {isActive && (
                <span className="absolute bottom-2 w-1 h-1 rounded-full bg-primary-500" />
            )}
        </NavLink>
    );
}

export function BottomNav() {
    const { isAuthenticated } = useAuth();
    const location = useLocation();
    const { t } = useLanguage();

    // Only show for authenticated users on mobile
    if (!isAuthenticated) return null;

    const isItemActive = (item: (typeof BOTTOM_NAV_ITEMS)[number]) => {
        const { pathname } = location;

        if (item.id === 'walletAdd') {
            return pathname === ROUTES.walletAdd;
        }

        if (item.id === 'wallet') {
            return (
                pathname === ROUTES.wallet ||
                (pathname.startsWith(`${ROUTES.wallet}/`) && pathname !== ROUTES.walletAdd)
            );
        }

        if (item.id === 'dashboard') {
            return pathname === ROUTES.dashboard;
        }

        return pathname === item.to || pathname.startsWith(`${item.to}/`);
    };

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-around z-50 lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {BOTTOM_NAV_ITEMS.map((item) => {
                const isActive = isItemActive(item);
                const label = t(item.labelKey);

                if (item.isCenter) {
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.id}
                            to={item.to}
                            className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 active:scale-95 transition-all duration-200"
                            aria-label={label}
                        >
                            <Icon className="w-6 h-6" strokeWidth={2.5} />
                        </NavLink>
                    );
                }

                return (
                    <NavItem
                        key={item.id}
                        to={item.to}
                        icon={<item.icon className="w-6 h-6" />}
                        ariaLabel={label}
                        isActive={isActive}
                    />
                );
            })}
        </nav>
    );
}
