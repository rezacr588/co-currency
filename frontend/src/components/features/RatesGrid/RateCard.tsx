import type { Rate } from '../../../types';
import { formatRate } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';

interface RateCardProps {
  rate: Rate;
  baseCurrency: string;
}

export function RateCard({ rate, baseCurrency }: RateCardProps) {
  const flag = CURRENCY_FLAGS[rate.code] || '🌍';
  const symbol = CURRENCY_SYMBOLS[rate.code] || '';

  return (
    <div className="group p-3 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/60 rounded-lg border border-slate-200/60 dark:border-slate-700/40 hover:border-primary-400 dark:hover:border-primary-600/30 transition-all duration-200">
      <div className="flex items-center gap-2">
        <span className="text-xl flex-shrink-0">{flag}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{rate.code}</span>
            <span className="font-mono text-sm font-semibold text-primary-700 dark:text-primary-500 truncate">
              {symbol}{formatRate(rate.rate)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
            1 {baseCurrency} = {rate.code}
          </p>
        </div>
      </div>
    </div>
  );
}
