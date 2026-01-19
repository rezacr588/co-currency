import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useConvert, useCurrencies } from '../../../hooks';
import { SwapButton } from './SwapButton';
import { InlineCurrencySelect } from './InlineCurrencySelect';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { useLanguage } from '../../../context/LanguageContext';
import { formatRate, formatNumber } from '../../../utils/format';
import { CURRENCY_SYMBOLS, CURRENCY_FLAGS } from '../../../utils/constants';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';

const STORAGE_KEY = 'currency-converter-state';

// Popular currency pairs
const POPULAR_PAIRS = [
  { from: 'USD', to: 'EUR' },
  { from: 'EUR', to: 'GBP' },
  { from: 'USD', to: 'JPY' },
  { from: 'GBP', to: 'USD' },
  { from: 'EUR', to: 'CHF' },
  { from: 'USD', to: 'CAD' },
];

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

// Animated number component
function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  return (
    <span
      className={`transition-all duration-300 ${
        isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
      } ${className}`}
    >
      {formatNumber(displayValue)}
    </span>
  );
}

export function Converter() {
  const initialState = loadState();
  const [amount, setAmount] = useState(initialState.amount);
  const [fromCurrency, setFromCurrency] = useState(initialState.fromCurrency);
  const [toCurrency, setToCurrency] = useState(initialState.toCurrency);
  const [isSwapping, setIsSwapping] = useState(false);
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
    setIsSwapping(true);
    setTimeout(() => {
      setFromCurrency(toCurrency);
      setToCurrency(fromCurrency);
      setIsSwapping(false);
    }, 150);
  }, [fromCurrency, toCurrency]);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleQuickPair = useCallback((from: string, to: string) => {
    setFromCurrency(from);
    setToCurrency(to);
  }, []);

  // Calculate if rate is favorable (just for visual indicator)
  const rateIndicator = useMemo(() => {
    if (!result?.rate) return null;
    // Just a visual indicator based on rate magnitude
    return result.rate >= 1 ? 'up' : 'down';
  }, [result?.rate]);

  return (
    <div className="w-full max-w-2xl mx-auto px-2 sm:px-4">
      {/* Floating decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 text-6xl opacity-5 animate-float-slow">💱</div>
        <div className="absolute top-40 right-20 text-5xl opacity-5 animate-float-slower">💰</div>
        <div className="absolute bottom-40 left-20 text-4xl opacity-5 animate-float">🌍</div>
      </div>

      {/* Main Card */}
      <div className="relative group">
        {/* Animated gradient background */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-30 transition-all duration-700 animate-gradient-shift" />

        {/* Glass Card */}
        <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-white/20 dark:border-slate-700/50 shadow-2xl shadow-slate-200/50 dark:shadow-black/30 overflow-hidden">
          {/* Top accent bar with gradient */}
          <div className="h-1 bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500" />

          {/* Header Section */}
          <div className="px-3 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/30 flex-shrink-0">
                  <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg font-bold text-slate-800 dark:text-white truncate">
                    {t('currencyConverter') || 'Currency Converter'}
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                    160+ currencies
                  </p>
                </div>
              </div>
              {result?.updated_at && (
                <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full flex-shrink-0">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400" />
                  <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(result.updated_at).toLocaleTimeString(undefined, {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Main Converter Section */}
          <div className="px-3 sm:px-6 pb-4 sm:pb-6 space-y-3 sm:space-y-4">
            {/* Converter Box - Minimal Coin Design */}
            <div
              className={`relative transition-all duration-300 ${
                isSwapping ? 'scale-[0.98]' : 'scale-100'
              }`}
            >
              {/* FROM Section - Top Half */}
              <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-3xl p-4 pb-6">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {t('from') || 'From'}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <CurrencyInput
                    value={amount}
                    onChange={setAmount}
                    currencyCode={fromCurrency}
                    currencySymbol={CURRENCY_SYMBOLS[fromCurrency]}
                    placeholder="0"
                  />
                  <InlineCurrencySelect
                    value={fromCurrency}
                    onChange={setFromCurrency}
                    currencies={currencies}
                  />
                </div>
              </div>

              {/* Swap Button - Coin Divider */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <SwapButton onClick={handleSwap} />
              </div>

              {/* TO Section - Bottom Half */}
              <div className="relative bg-slate-50 dark:bg-slate-800/50 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-3xl p-4 pt-6">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  {t('to') || 'To'}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 min-w-0 py-2 overflow-hidden">
                    {isLoading ? (
                      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                    ) : error ? (
                      <span className="text-sm text-red-500">Error</span>
                    ) : result ? (
                      <div className="flex items-baseline gap-1 overflow-hidden">
                        <span className="text-base text-slate-400 flex-shrink-0">
                          {CURRENCY_SYMBOLS[toCurrency] || ''}
                        </span>
                        <AnimatedNumber
                          value={result.result}
                          className="text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-white tabular-nums truncate"
                        />
                        {rateIndicator && (
                          <div
                            className={`flex-shrink-0 ml-1 ${
                              rateIndicator === 'up'
                                ? 'text-emerald-500'
                                : 'text-amber-500'
                            }`}
                          >
                            {rateIndicator === 'up' ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-2xl text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </div>
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
              <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-amber-700 dark:text-amber-400 text-center text-sm animate-fade-in">
                {validationError}
              </div>
            )}

            {/* Exchange Rate Pills */}
            {!validationError && result && (
              <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl shadow-sm text-xs sm:text-sm">
                  <span className="text-base sm:text-lg">{CURRENCY_FLAGS[result.from] || '🌍'}</span>
                  <span className="text-slate-600 dark:text-slate-300">1 {result.from}</span>
                  <span className="text-slate-300 dark:text-slate-600">=</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white truncate max-w-[80px] sm:max-w-none">
                    {formatRate(result.rate)}
                  </span>
                  <span className="text-base sm:text-lg">{CURRENCY_FLAGS[result.to] || '🌍'}</span>
                  <span className="text-slate-600 dark:text-slate-300">{result.to}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {!validationError && error && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-center">
                <p className="text-red-600 dark:text-red-400 text-sm mb-3">{t('failedToConvert')}</p>
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  {t('retry')}
                </button>
              </div>
            )}
          </div>

          {/* Popular Pairs Section */}
          <div className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-primary-500" />
              <span className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('popularPairs') || 'Popular Pairs'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {POPULAR_PAIRS.map((pair) => {
                const isActive = pair.from === fromCurrency && pair.to === toCurrency;
                return (
                  <button
                    key={`${pair.from}-${pair.to}`}
                    onClick={() => handleQuickPair(pair.from, pair.to)}
                    className={`flex items-center gap-0.5 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-105'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-105'
                    }`}
                  >
                    <span className="text-sm sm:text-base">{CURRENCY_FLAGS[pair.from]}</span>
                    <span>{pair.from}</span>
                    <span className="text-slate-400 dark:text-slate-500">→</span>
                    <span>{pair.to}</span>
                    <span className="text-sm sm:text-base">{CURRENCY_FLAGS[pair.to]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-3 sm:px-6 py-3 sm:py-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-700/50">
            <div className="flex items-center justify-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live rates
              </span>
              <span>•</span>
              <span>Updated daily</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
