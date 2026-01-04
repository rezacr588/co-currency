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
    <div className="card p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flag}</span>
        <div>
          <p className="font-semibold text-slate-100">{rate.code}</p>
          <p className="text-sm text-slate-400">{rate.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-lg font-semibold text-slate-100">
          {symbol}{formatRate(rate.rate)}
        </p>
        <p className="text-xs text-slate-400">
          1 {baseCurrency} = {formatRate(rate.rate)} {rate.code}
        </p>
      </div>
    </div>
  );
}
