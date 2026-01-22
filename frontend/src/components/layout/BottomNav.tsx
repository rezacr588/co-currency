import { NavLink, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Wallet,
    Plus,
    Target,
    MoreHorizontal,
} from 'lucide-react';

interface NavItemProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
}

function NavItem({ to, icon, label, isActive }: NavItemProps) {
    return (
        <NavLink
            to={to}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
        >
            <span className="w-6 h-6">{icon}</span>
            <span className="text-[10px] font-medium">{label}</span>
        </NavLink>
    );
}

export function BottomNav() {
    const { t } = useLanguage();
    const { isAuthenticated } = useAuth();
    const location = useLocation();

    // Only show for authenticated users on mobile
    if (!isAuthenticated) return null;

    const navItems = [
        { to: '/dashboard', icon: <LayoutDashboard className="w-6 h-6" />, label: t('dashboard') },
        { to: '/wallet', icon: <Wallet className="w-6 h-6" />, label: t('wallet') },
        { to: '/wallet/add', icon: <Plus className="w-6 h-6" />, label: t('addTransaction'), isCenter: true },
        { to: '/goals', icon: <Target className="w-6 h-6" />, label: t('financialGoals') },
        { to: '/reports', icon: <MoreHorizontal className="w-6 h-6" />, label: t('reportsAndStats') },
    ];

    return (
        <nav className="bottom-nav lg:hidden">
            {navItems.map((item) => {
                const isActive = location.pathname === item.to ||
                    (item.to !== '/' && location.pathname.startsWith(item.to));

                if (item.isCenter) {
                    return (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className="flex items-center justify-center w-14 h-14 -mt-6 rounded-full bg-gradient-to-br from-primary-600 to-primary-700 text-white shadow-lg shadow-primary-500/30 touch-target"
                        >
                            <Plus className="w-7 h-7" />
                        </NavLink>
                    );
                }

                return (
                    <NavItem
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        isActive={isActive}
                    />
                );
            })}
        </nav>
    );
}
