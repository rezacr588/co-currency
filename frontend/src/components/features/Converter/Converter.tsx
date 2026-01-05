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
    <div className="w-full max-w-2xl mx-auto animate-fade-in">
      {/* Main Card */}
      <div className="relative group">
        {/* Ambient glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-all duration-700" />

        {/* Card */}
        <div className="relative overflow-hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2rem] border border-slate-200/60 dark:border-slate-800/60 shadow-2xl">
          {/* Minimal gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          {/* Content */}
          <div className="p-6 sm:p-10 space-y-8">
            {/* Header - Minimal */}
            <div className="text-center">
              <h2 className="text-2xl sm:text-3xl font-light text-slate-800 dark:text-white tracking-wide">
                {t('converterTitle')}
              </h2>
            </div>

            {/* Amount Input */}
            <AmountInput value={amount} onChange={setAmount} />

            {/* Currency Selectors */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
              <div className="flex-1">
                <CurrencySelect
                  value={fromCurrency}
                  onChange={setFromCurrency}
                  currencies={currencies}
                  label={t('from')}
                />
              </div>

              <div className="flex justify-center sm:pt-6">
                <SwapButton onClick={handleSwap} />
              </div>

              <div className="flex-1">
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
              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-400 text-center text-sm font-medium animate-fade-in" role="alert">
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
