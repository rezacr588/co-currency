import { useState, useMemo, useCallback } from 'react';
import { useConvert, useCurrencies } from '../../../hooks';
import { AmountInput } from './AmountInput';
import { CurrencySelect } from './CurrencySelect';
import { SwapButton } from './SwapButton';
import { ResultDisplay } from './ResultDisplay';
import { useLanguage } from '../../../context/LanguageContext';

export function Converter() {
  const [amount, setAmount] = useState(1);
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const { t } = useLanguage();

  const { data: currencies } = useCurrencies();
  const { data: result, isLoading, error, refetch } = useConvert(
    fromCurrency,
    toCurrency,
    amount
  );

  const validationError = useMemo(() => {
    if (fromCurrency === toCurrency) {
      return t('sameCurrency');
    }
    return undefined;
  }, [fromCurrency, toCurrency, t]);

  const handleSwap = useCallback(() => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  }, [fromCurrency, toCurrency]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Main Card */}
      <div className="relative group">
        {/* Ambient glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />

        {/* Card */}
        <div className="relative bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg overflow-hidden">
          {/* Gradient accent line */}
          <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Content */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Amount Input - Compact */}
            <AmountInput value={amount} onChange={setAmount} />

            {/* Currency Selectors - Inline on larger screens */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="flex-1 min-w-0">
                <CurrencySelect
                  value={fromCurrency}
                  onChange={setFromCurrency}
                  currencies={currencies}
                  label={t('from')}
                />
              </div>

              <div className="flex justify-center items-end pb-1 sm:pb-0 sm:pt-5">
                <SwapButton onClick={handleSwap} />
              </div>

              <div className="flex-1 min-w-0">
                <CurrencySelect
                  value={toCurrency}
                  onChange={setToCurrency}
                  currencies={currencies}
                  label={t('to')}
                />
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-center text-sm animate-fade-in" role="alert">
                {validationError}
              </div>
            )}

            {/* Result Display */}
            {!validationError && (
              <ResultDisplay
                result={result}
                isLoading={isLoading}
                error={error}
                onRetry={handleRetry}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
