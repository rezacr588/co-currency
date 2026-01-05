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

  // Validation
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
      {/* Glass Card Container */}
      <div className="relative overflow-hidden bg-white/80 dark:bg-slate-800/60 backdrop-blur-xl rounded-3xl border border-slate-200 dark:border-slate-700/50 shadow-xl dark:shadow-2xl dark:shadow-slate-900/50">
        {/* Gradient Background Decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/5 via-transparent to-accent-600/5" aria-hidden="true" />

        {/* Header */}
        <div className="relative px-4 sm:px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-700/50">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 text-center">{t('converterTitle')}</h2>
        </div>

        {/* Content */}
        <div className="relative p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* Amount Input */}
          <AmountInput value={amount} onChange={setAmount} />

          {/* Currency Selectors with Swap */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <CurrencySelect
                value={fromCurrency}
                onChange={setFromCurrency}
                currencies={currencies}
                label={t('from')}
              />
            </div>

            <div className="flex justify-center sm:pb-6">
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
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-yellow-600 dark:text-yellow-400 text-center text-sm" role="alert">
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
  );
}
