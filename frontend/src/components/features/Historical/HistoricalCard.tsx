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
      <div className="card p-4 bg-red-500/10 border-red-500/30">
        <p className="text-red-400 text-sm">Failed to load</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="text-sm text-slate-400 mb-2">{formatDate(date)}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{flag}</span>
          <span className="font-medium">{targetCurrency}</span>
        </div>
        {isLoading ? (
          <Skeleton width={80} height={24} />
        ) : (
          <span className="font-mono text-lg font-semibold text-primary-400">
            {rate ? formatRate(rate.rate) : 'N/A'}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 mt-1">
        1 {baseCurrency} = {rate ? formatRate(rate.rate) : '...'} {targetCurrency}
      </p>
    </div>
  );
}
