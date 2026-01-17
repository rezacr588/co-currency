import { Button } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';

interface CurrencySetupProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const POPULAR_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼', flag: '🇮🇷' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', flag: '🇹🇷' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
];

export function CurrencySetup({
  selectedCurrency,
  onCurrencyChange,
  onNext,
  onBack,
}: CurrencySetupProps) {
  const { t } = useLanguage();

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {t('selectPrimaryCurrency') || 'Select Your Primary Currency'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t('primaryCurrencyDesc') ||
            "Choose the currency you use most often. You can always add more later."}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {POPULAR_CURRENCIES.map((currency) => (
          <button
            key={currency.code}
            onClick={() => onCurrencyChange(currency.code)}
            className={`p-4 rounded-xl border-2 transition-all text-center ${
              selectedCurrency === currency.code
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
            }`}
          >
            <div className="text-2xl mb-1">{currency.flag}</div>
            <div className="font-semibold text-slate-900 dark:text-white">
              {currency.code}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {currency.symbol}
            </div>
          </button>
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="secondary" onClick={onBack}>
          {t('back') || 'Back'}
        </Button>
        <Button variant="primary" onClick={onNext}>
          {t('continue') || 'Continue'}
        </Button>
      </div>
    </div>
  );
}
