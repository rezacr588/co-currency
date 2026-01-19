import { useConvert } from '../../../hooks';
import { Globe } from 'lucide-react';
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

  const fromFlag = CURRENCY_FLAGS[from];
  const toFlag = CURRENCY_FLAGS[to];
  const toSymbol = CURRENCY_SYMBOLS[to] || '';

  if (error) {
    return (
      <div className="p-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
        <p className="text-red-500 dark:text-red-400 text-xs">{t('failedToLoad')}</p>
      </div>
    );
  }

  return (
    <div className="group p-2.5 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/40 hover:border-primary-400 dark:hover:border-primary-600/30 transition-all duration-200">
      <div className="flex flex-col gap-1">
        {/* From */}
        <div className="flex items-center gap-1.5">
          {fromFlag ? (
            <span className="text-base flex-shrink-0">{fromFlag}</span>
          ) : (
            <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{formatNumber(amount, 0)}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{from}</span>
        </div>
        {/* To */}
        <div className="flex items-center gap-1.5">
          {toFlag ? (
            <span className="text-base flex-shrink-0">{toFlag}</span>
          ) : (
            <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
          )}
          {isLoading ? (
            <Skeleton width={50} height={14} />
          ) : (
            <span className="text-xs font-semibold text-primary-700 dark:text-primary-500 truncate">
              {toSymbol}{formatNumber(data?.result || 0, 2)}
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{to}</span>
        </div>
      </div>
    </div>
  );
}
