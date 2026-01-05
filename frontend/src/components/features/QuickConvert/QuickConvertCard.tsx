import { useConvert } from '../../../hooks';
import { formatNumber } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';
import { Skeleton } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';

interface QuickConvertCardProps {
  from: string;
  to: string;
  amount: number;
}

export function QuickConvertCard({ from, to, amount }: QuickConvertCardProps) {
  const { data, isLoading, error } = useConvert(from, to, amount);
  const { t } = useLanguage();

  const fromFlag = CURRENCY_FLAGS[from] || '';
  const toFlag = CURRENCY_FLAGS[to] || '';
  const toSymbol = CURRENCY_SYMBOLS[to] || '';

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
        <p className="text-red-500 dark:text-red-400 text-sm">{t('failedToLoad')}</p>
      </div>
    );
  }

  return (
    <div className="group p-4 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/40 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 text-lg">{fromFlag}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{formatNumber(amount, 0)}</span>
          <span className="text-slate-400 dark:text-slate-500 text-sm">{from}</span>
        </div>
        <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 text-lg">{toFlag}</span>
          {isLoading ? (
            <Skeleton width={60} height={20} />
          ) : (
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 truncate">
              {toSymbol}{formatNumber(data?.result || 0, 2)}
            </span>
          )}
          <span className="text-slate-400 dark:text-slate-500 text-sm">{to}</span>
        </div>
      </div>
    </div>
  );
}
