import { useLanguage } from '../../../context/LanguageContext';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  error?: string;
}

export function AmountInput({ value, onChange, error }: AmountInputProps) {
  const { t } = useLanguage();
  const inputId = 'amount-input';
  const errorId = 'amount-error';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (isNaN(val)) {
      onChange(0);
    } else if (val < 0) {
      onChange(0);
    } else if (val > 999999999999) {
      onChange(999999999999);
    } else {
      onChange(val);
    }
  };

  return (
    <div className="relative">
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
      >
        {t('amount')}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="number"
          value={value || ''}
          onChange={handleChange}
          min="0"
          max="999999999999"
          step="any"
          inputMode="decimal"
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={`w-full bg-white dark:bg-slate-800/80 border rounded-xl px-4 py-3.5 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 hover:border-primary-500/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all min-h-[56px] ${
            error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-300 dark:border-slate-600/50'
          }`}
          placeholder="0.00"
        />
        <div className="absolute inset-y-0 end-0 flex items-center pe-4 pointer-events-none">
          <svg className="w-5 h-5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
