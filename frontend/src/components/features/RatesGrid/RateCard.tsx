import type { Rate } from '../../../types';
import { formatRate } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';

interface RateCardProps {
  rate: Rate;
  baseCurrency: string;
}

export function RateCard({ rate, baseCurrency }: RateCardProps) {
  const flag = CURRENCY_FLAGS[rate.code] || '';
  const symbol = CURRENCY_SYMBOLS[rate.code] || '';

  return (
    <div className="group p-4 bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/40 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all duration-200 hover:shadow-md flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-700/50 rounded-full shadow-sm">
          <span className="text-xl">{flag}</span>
        </div>
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100">{rate.code}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{rate.name}</p>
        </div>
      </div>
      <div className="text-end">
        <p className="font-mono text-lg font-semibold text-indigo-600 dark:text-indigo-400">
          {symbol}{formatRate(rate.rate)}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          1 {baseCurrency}
        </p>
      </div>
    </div>
  );
}
