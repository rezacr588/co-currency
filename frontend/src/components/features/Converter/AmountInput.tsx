import { useLanguage } from '../../../context/LanguageContext';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
}

export function AmountInput({ value, onChange }: AmountInputProps) {
  const { t } = useLanguage();

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
        {t('amount')}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          min="0"
          step="any"
          className="w-full bg-slate-800/80 border border-slate-600/50 rounded-xl px-4 py-3.5 text-2xl font-bold text-slate-100 placeholder-slate-500 hover:border-primary-500/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none transition-all"
          placeholder="0.00"
        />
        <div className="absolute inset-y-0 end-0 flex items-center pe-4 pointer-events-none">
          <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
