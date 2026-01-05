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
        className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest"
      >
        {label}
      </label>
      <div className="relative">
        {/* Flag display */}
        <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none" aria-hidden="true">
          <span className="text-3xl filter drop-shadow-sm">{flag}</span>
        </div>

        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700/50 rounded-2xl ps-14 pe-12 py-4 text-lg font-medium text-slate-800 dark:text-white appearance-none cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/50 focus:border-indigo-500 dark:focus:border-indigo-500 focus:outline-none transition-all duration-300"
        >
          {currencies?.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
        </select>

        {/* Custom dropdown arrow */}
        <div className="absolute inset-y-0 end-0 flex items-center pe-4 pointer-events-none" aria-hidden="true">
          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Subtle focus glow */}
        <div className="absolute inset-0 -z-10 rounded-2xl bg-indigo-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Currency name subtitle */}
      {selectedCurrency && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 truncate font-light">{selectedCurrency.name}</p>
      )}
    </div>
  );
}
