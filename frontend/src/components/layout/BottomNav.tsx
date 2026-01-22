import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Wallet,
    Plus,
    Target,
    BarChart3,
} from 'lucide-react';

interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    isActive?: boolean;
}

function NavItem({ to, icon, isActive }: NavItemProps) {
    return (
        <NavLink
            to={to}
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

    // Only show for authenticated users on mobile
    if (!isAuthenticated) return null;

    const navItems = [
        { to: '/dashboard', icon: <LayoutDashboard className="w-6 h-6" /> },
        { to: '/wallet', icon: <Wallet className="w-6 h-6" /> },
        { to: '/wallet/add', icon: <Plus className="w-7 h-7" />, isCenter: true },
        { to: '/goals', icon: <Target className="w-6 h-6" /> },
        { to: '/reports', icon: <BarChart3 className="w-6 h-6" /> },
    ];

    return (
        <nav
            className="fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-around z-50 lg:hidden"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
            {navItems.map((item) => {
                const isActive = location.pathname === item.to ||
                    (item.to !== '/' && location.pathname.startsWith(item.to));

                if (item.isCenter) {
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className="flex items-center justify-center w-12 h-12 -mt-4 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30 active:scale-95 transition-all duration-200"
                        >
                            <Plus className="w-6 h-6" strokeWidth={2.5} />
                        </NavLink>
                    );
                }

                return (
                    <NavItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        isActive={isActive}
                    />
                );
            })}
        </nav>
    );
}
