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
        className="block text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 uppercase tracking-widest"
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
          className={`w-full bg-slate-50 dark:bg-slate-800/50 border-2 rounded-2xl px-5 py-4 text-3xl sm:text-4xl font-light text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 transition-all duration-300 focus:outline-none ${
            error
              ? 'border-red-400 focus:border-red-500'
              : 'border-slate-200 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 focus:border-indigo-500 dark:focus:border-indigo-500'
          }`}
          placeholder="0"
        />
        {/* Subtle focus glow */}
        <div className="absolute inset-0 -z-10 rounded-2xl bg-indigo-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-sm text-red-500 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
