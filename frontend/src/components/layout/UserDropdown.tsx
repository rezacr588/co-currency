import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { AUTH_NAV_ITEMS } from '../../constants/navigation';

export function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { t, isRTL } = useLanguage();
  const { user, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuItems = AUTH_NAV_ITEMS.filter((item) =>
    ['dashboard', 'wallet', 'goals', 'budgets', 'recurring', 'reports'].includes(item.id)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="hidden md:inline">{user?.name}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 ${isRTL ? 'left-0' : 'right-0'}`}>
          <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
            <p className="px-2 py-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {t('navigation')}
            </p>
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
              <Link
                key={item.id}
                to={item.to}
                onClick={() => setIsOpen(false)}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${
                  location.pathname === item.to || location.pathname.startsWith(item.to + '/')
                    ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t(item.labelKey)}
              </Link>
            )})}
          </div>
          <div className="p-2">
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50 text-rose-600 dark:text-rose-400 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t('logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
