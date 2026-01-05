import { useMemo, useId } from 'react';
import type { Currency } from '../../../types';
import { CURRENCY_FLAGS } from '../../../utils/constants';

interface CurrencySelectProps {
  value: string;
  onChange: (value: string) => void;
  currencies?: Currency[];
  label: string;
}

export function CurrencySelect({ value, onChange, currencies, label }: CurrencySelectProps) {
  const id = useId();
  const selectedCurrency = useMemo(() => {
    return currencies?.find(c => c.code === value);
  }, [currencies, value]);

  const flag = CURRENCY_FLAGS[value] || '🌍';

  return (
    <div className="relative group">
      <label
        htmlFor={id}
        className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
      >
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none" aria-hidden="true">
          <span className="text-2xl">{flag}</span>
        </div>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600/50 rounded-xl ps-12 pe-10 py-3.5 text-base font-semibold text-slate-900 dark:text-slate-100 appearance-none cursor-pointer hover:border-primary-500/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all min-h-[56px]"
        >
          {currencies?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} - {c.name}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none" aria-hidden="true">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {selectedCurrency && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{selectedCurrency.name}</p>
      )}
    </div>
  );
}
