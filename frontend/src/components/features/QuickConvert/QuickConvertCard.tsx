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
      <div className="card p-4 bg-red-500/10 border-red-500/30">
        <p className="text-red-400 text-sm">{t('failedToLoad')}</p>
      </div>
    );
  }

  return (
    <div className="card p-4 hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0">{fromFlag}</span>
          <span className="font-medium">{formatNumber(amount, 0)}</span>
          <span className="text-slate-400">{from}</span>
        </div>
        <span className="text-slate-400 flex-shrink-0">=</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0">{toFlag}</span>
          {isLoading ? (
            <Skeleton width={60} height={20} />
          ) : (
            <span className="font-semibold text-primary-400 truncate">
              {toSymbol}{formatNumber(data?.result || 0, 2)}
            </span>
          )}
          <span className="text-slate-400">{to}</span>
        </div>
      </div>
    </div>
  );
}
