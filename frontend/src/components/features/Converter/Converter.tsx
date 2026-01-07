import { useState, useMemo, useCallback, useEffect } from 'react';
import { useConvert, useCurrencies } from '../../../hooks';
import { SwapButton } from './SwapButton';
import { InlineCurrencySelect } from './InlineCurrencySelect';
import { useLanguage } from '../../../context/LanguageContext';
import { formatRate, formatNumber } from '../../../utils/format';
import { CURRENCY_SYMBOLS } from '../../../utils/constants';

const STORAGE_KEY = 'currency-converter-state';

interface ConverterState {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}

function loadState(): ConverterState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        amount: typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : 1,
        fromCurrency: typeof parsed.fromCurrency === 'string' ? parsed.fromCurrency : 'USD',
        toCurrency: typeof parsed.toCurrency === 'string' ? parsed.toCurrency : 'EUR',
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { amount: 1, fromCurrency: 'USD', toCurrency: 'EUR' };
}

function saveState(state: ConverterState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export function Converter() {
  const initialState = loadState();
  const [amount, setAmount] = useState(initialState.amount);
  const [fromCurrency, setFromCurrency] = useState(initialState.fromCurrency);
  const [toCurrency, setToCurrency] = useState(initialState.toCurrency);
  const { t } = useLanguage();

  const { data: currencies } = useCurrencies();
  const { data: result, isLoading, error, refetch } = useConvert(
    fromCurrency,
    toCurrency,
    amount
  );

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState({ amount, fromCurrency, toCurrency });
  }, [amount, fromCurrency, toCurrency]);

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
            {/* Single Inline Converter Box */}
            <div className="relative bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all duration-200 hover:border-indigo-400 dark:hover:border-indigo-500 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30">
              <div className="flex flex-col sm:flex-row items-stretch">
                {/* FROM: Amount Input + Currency */}
                <div className="flex-1 min-w-0 flex items-stretch border-b sm:border-b-0 sm:border-e border-slate-200 dark:border-slate-700">
                  {/* Amount Input */}
                  <input
                    type="number"
                    value={amount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) setAmount(0);
                      else if (val < 0) setAmount(0);
                      else if (val > 999999999999) setAmount(999999999999);
                      else setAmount(val);
                    }}
                    min="0"
                    max="999999999999"
                    step="any"
                    inputMode="decimal"
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent px-3 sm:px-4 py-3 text-xl sm:text-2xl font-light text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none"
                  />

                  {/* FROM Currency Selector */}
                  <InlineCurrencySelect
                    value={fromCurrency}
                    onChange={setFromCurrency}
                    currencies={currencies}
                  />
                </div>

                {/* Swap Button */}
                <div className="flex justify-center items-center bg-slate-50 dark:bg-slate-800/50 border-b sm:border-b-0 border-slate-200 dark:border-slate-700 py-2 sm:py-0">
                  <SwapButton onClick={handleSwap} />
                </div>

                {/* TO: Result + Currency */}
                <div className="flex-1 min-w-0 flex items-stretch">
                  {/* Result Display */}
                  <div className="flex-1 min-w-0 px-3 sm:px-4 py-3 flex items-center">
                    {isLoading ? (
                      <div className="w-full h-8 bg-slate-100 dark:bg-slate-700/50 rounded animate-pulse" />
                    ) : error ? (
                      <span className="text-sm text-red-500 dark:text-red-400">Error</span>
                    ) : result ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm text-slate-400 dark:text-slate-500">{CURRENCY_SYMBOLS[toCurrency] || ''}</span>
                        <span className="text-xl sm:text-2xl font-light text-slate-800 dark:text-white">
                          {formatNumber(result.result)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xl sm:text-2xl font-light text-slate-300 dark:text-slate-600">-</span>
                    )}
                  </div>

                  {/* TO Currency Selector */}
                  <InlineCurrencySelect
                    value={toCurrency}
                    onChange={setToCurrency}
                    currencies={currencies}
                  />
                </div>
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-center text-sm animate-fade-in" role="alert">
                {validationError}
              </div>
            )}

            {/* Exchange Rate Info - Compact */}
            {!validationError && result && (
              <div className="flex flex-wrap justify-center gap-2 text-[11px] pt-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full text-slate-500 dark:text-slate-400">
                  <span>1 {result.from}</span>
                  <span className="text-slate-300 dark:text-slate-600">=</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatRate(result.rate)}</span>
                  <span>{result.to}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-full text-slate-500 dark:text-slate-400">
                  <span>1 {result.to}</span>
                  <span className="text-slate-300 dark:text-slate-600">=</span>
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                    {result.rate > 0 ? formatRate(1 / result.rate) : '0'}
                  </span>
                  <span>{result.from}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {!validationError && error && (
              <div
                className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-center animate-fade-in"
                role="alert"
                aria-live="assertive"
              >
                <p className="text-red-600 dark:text-red-400 text-sm mb-3">{t('failedToConvert')}</p>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30"
                  aria-label={t('retry')}
                >
                  {t('retry')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
