import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';
import { formatNumber } from '../../../utils/format';
import type { Currency, ConversionResult } from '../../../types';

interface ResultCurrencyDisplayProps {
  result?: ConversionResult;
  isLoading: boolean;
  error: Error | null;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  currencies?: Currency[];
  label: string;
}

export function ResultCurrencyDisplay({
  result,
  isLoading,
  error,
  currency,
  onCurrencyChange,
  currencies = [],
  label,
}: ResultCurrencyDisplayProps) {
  const currencyFlag = CURRENCY_FLAGS[currency] || '🌍';
  const currencySymbol = CURRENCY_SYMBOLS[currency] || '';

  return (
    <div className="flex-1 min-w-0">
      <label
        className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
      >
        {label}
      </label>
      <div
        className={`relative bg-white dark:bg-slate-800/80 border rounded-xl overflow-hidden transition-all duration-200 ${
          error
            ? 'border-red-400'
            : 'border-slate-200 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500'
        }`}
      >
        <div className="flex items-stretch">
          {/* Result Display */}
          <div className="flex-1 min-w-0 px-3 py-3 flex items-center">
            {isLoading ? (
              <div className="w-full h-8 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
            ) : error ? (
              <span className="text-sm text-red-500 dark:text-red-400">Error</span>
            ) : result ? (
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-slate-400 dark:text-slate-500">{currencySymbol}</span>
                <span className="text-xl sm:text-2xl font-light text-slate-800 dark:text-white">
                  {formatNumber(result.result)}
                </span>
              </div>
            ) : (
              <span className="text-xl sm:text-2xl font-light text-slate-300 dark:text-slate-600">
                -
              </span>
            )}
          </div>

          {/* Currency Selector Button */}
          <button
            type="button"
            onClick={() => {
              const select = document.getElementById(`currency-select-${label}`) as HTMLSelectElement;
              if (select) select.focus();
            }}
            className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-600/50 border-s border-slate-200 dark:border-slate-600 transition-colors"
            aria-label={`Select ${label} currency`}
          >
            <span className="text-2xl">{currencyFlag}</span>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {currency}
            </span>
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Hidden Native Select */}
          <select
            id={`currency-select-${label}`}
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label={label}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
