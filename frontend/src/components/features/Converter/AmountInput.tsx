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
        className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider"
      >
        {t('amount')}
      </label>
      <div className="relative group">
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
          className={`w-full bg-white dark:bg-slate-800/80 border rounded-xl px-4 py-3 text-2xl sm:text-3xl font-light text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-600/30 ${
            error
              ? 'border-red-400 focus:border-red-500'
              : 'border-slate-200 dark:border-slate-700 hover:border-primary-500 dark:hover:border-primary-600 focus:border-primary-600'
          }`}
          placeholder="0"
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
