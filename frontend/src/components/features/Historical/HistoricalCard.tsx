import { useHistorical } from '../../../hooks';
import { formatRate, formatDate } from '../../../utils/format';
import { CURRENCY_FLAGS } from '../../../utils/constants';
import { Skeleton } from '../../ui';

interface HistoricalCardProps {
  date: string;
  baseCurrency: string;
  targetCurrency: string;
}

export function HistoricalCard({ date, baseCurrency, targetCurrency }: HistoricalCardProps) {
  const { data, isLoading, error } = useHistorical(date, baseCurrency);

  const rate = data?.rates.find((r) => r.code === targetCurrency);
  const flag = CURRENCY_FLAGS[targetCurrency] || '';

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
        <p className="text-red-500 dark:text-red-400 text-sm">Failed to load</p>
      </div>
    );
  }

  return (
    <div className="group p-4 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/40 hover:border-primary-400 dark:hover:border-primary-600/30 transition-all duration-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-600"></div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{formatDate(date)}</p>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">{targetCurrency}</span>
        </div>
        {isLoading ? (
          <Skeleton width={80} height={24} />
        ) : (
          <span className="font-mono text-lg font-semibold text-primary-700 dark:text-primary-500">
            {rate ? formatRate(rate.rate) : 'N/A'}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        1 {baseCurrency} = {rate ? formatRate(rate.rate) : '...'} {targetCurrency}
      </p>
    </div>
  );
}
