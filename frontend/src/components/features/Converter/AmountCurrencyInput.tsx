import { CURRENCY_FLAGS } from '../../../utils/constants';
import type { Currency } from '../../../types';

interface AmountCurrencyInputProps {
  amount: number;
  onAmountChange: (value: number) => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
  currencies?: Currency[];
  label: string;
  error?: string;
}

export function AmountCurrencyInput({
  amount,
  onAmountChange,
  currency,
  onCurrencyChange,
  currencies = [],
  label,
  error,
}: AmountCurrencyInputProps) {

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) {
      onAmountChange(0);
    } else if (val < 0) {
      onAmountChange(0);
    } else if (val > 999999999999) {
      onAmountChange(999999999999);
    } else {
      onAmountChange(val);
    }
  };

  const currencyFlag = CURRENCY_FLAGS[currency] || '🌍';

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
            : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30'
        }`}
      >
        <div className="flex items-stretch">
          {/* Amount Input */}
          <input
            type="number"
            value={amount || ''}
            onChange={handleAmountChange}
            min="0"
            max="999999999999"
            step="any"
            inputMode="decimal"
            aria-invalid={!!error}
            className="flex-1 min-w-0 bg-transparent px-3 py-3 text-xl sm:text-2xl font-light text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none"
            placeholder="0"
          />

          {/* Currency Selector Button */}
          <button
            type="button"
            onClick={() => {
              // Open currency selector - we'll enhance this with a dropdown
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

          {/* Hidden Native Select - Simple Version */}
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
      {error && (
        <p className="mt-1.5 text-xs text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
