import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { formatCompactCurrency } from '../../utils/format';

export function BalanceDisplay() {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['wallet-summary'],
    queryFn: () => api.wallet.getSummary(),
    staleTime: 30 * 1000,
    enabled: isAuthenticated,
  });

  if (!isAuthenticated) return null;

  const balance = summary?.total_balance_usd ?? 0;
  const hasBalance = !isLoading && !error && summary;

  return (
    <Link
      to="/wallet"
      className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/30 hover:border-primary-300 dark:hover:border-primary-600 transition-all group"
      title={t('totalBalance')}
    >
      <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-primary-800 dark:bg-primary-700">
        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="hidden sm:block text-[10px] font-medium text-primary-700/70 dark:text-primary-400/70 uppercase tracking-wider leading-none">
          {t('balance')}
        </span>
        {isLoading ? (
          <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 animate-pulse">---</span>
        ) : error ? (
          <span className="text-xs sm:text-sm font-bold text-rose-500 dark:text-rose-400">--</span>
        ) : (
          <span className={`text-xs sm:text-sm font-bold leading-tight ${hasBalance && balance > 0
            ? 'text-green-600 dark:text-green-400'
            : hasBalance && balance < 0
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-600 dark:text-slate-400'
            }`}>
            {formatCompactCurrency(balance, 'USD')}
          </span>
        )}
      </div>
    </Link>
  );
}
