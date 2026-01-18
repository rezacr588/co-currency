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
    <div className="w-full max-w-2xl mx-auto px-4">
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
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/30">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                    {t('currencyConverter') || 'Currency Converter'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    160+ currencies • Real-time rates
                  </p>
                </div>
              </div>
              {result?.updated_at && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
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
          <div className="px-6 pb-6 space-y-4">
            {/* Converter Box */}
            <div
              className={`relative bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden transition-all duration-300 ${
                isSwapping ? 'scale-[0.98]' : 'scale-100'
              }`}
            >
              {/* FROM Section */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-700/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('from') || 'From'}
                  </span>
                  <span className="text-2xl">{CURRENCY_FLAGS[fromCurrency] || '🌍'}</span>
                </div>
                <div className="flex items-center gap-3">
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

              {/* Swap Button - Center */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <SwapButton onClick={handleSwap} />
              </div>

              {/* TO Section */}
              <div className="p-4 bg-white/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {t('to') || 'To'}
                  </span>
                  <span className="text-2xl">{CURRENCY_FLAGS[toCurrency] || '🌍'}</span>
                </div>
                <div className="flex items-center gap-3">
                  {/* Result Display */}
                  <div className="flex-1 min-w-0 py-3 px-1">
                    {isLoading ? (
                      <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-lg animate-pulse" />
                    ) : error ? (
                      <span className="text-sm text-red-500">Error loading rate</span>
                    ) : result ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg text-slate-400 dark:text-slate-500">
                          {CURRENCY_SYMBOLS[toCurrency] || ''}
                        </span>
                        <AnimatedNumber
                          value={result.result}
                          className="text-3xl sm:text-4xl font-bold text-slate-800 dark:text-white tabular-nums"
                        />
                        {rateIndicator && (
                          <div
                            className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-xs font-medium ${
                              rateIndicator === 'up'
                                ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                : 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
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
                      <span className="text-3xl text-slate-300 dark:text-slate-600">—</span>
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
              <div className="flex flex-wrap justify-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
                  <span className="text-lg">{CURRENCY_FLAGS[result.from] || '🌍'}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">1 {result.from}</span>
                  <span className="text-slate-300 dark:text-slate-600">=</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-white">
                    {formatRate(result.rate)}
                  </span>
                  <span className="text-lg">{CURRENCY_FLAGS[result.to] || '🌍'}</span>
                  <span className="text-sm text-slate-600 dark:text-slate-300">{result.to}</span>
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
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary-500" />
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t('popularPairs') || 'Popular Pairs'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_PAIRS.map((pair) => {
                const isActive = pair.from === fromCurrency && pair.to === toCurrency;
                return (
                  <button
                    key={`${pair.from}-${pair.to}`}
                    onClick={() => handleQuickPair(pair.from, pair.to)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-105'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:scale-105'
                    }`}
                  >
                    <span className="text-base">{CURRENCY_FLAGS[pair.from]}</span>
                    <span>{pair.from}</span>
                    <span className="text-slate-400 dark:text-slate-500">→</span>
                    <span>{pair.to}</span>
                    <span className="text-base">{CURRENCY_FLAGS[pair.to]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-200/80 dark:border-slate-700/50">
            <div className="flex items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live rates from ECB
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
