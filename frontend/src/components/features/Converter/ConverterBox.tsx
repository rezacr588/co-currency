import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import type { Currency } from '../../../types';
import { useLanguage } from '../../../context/LanguageContext';
import { formatNumber } from '../../../utils/format';
import { CURRENCY_SYMBOLS } from '../../../utils/constants';
import { CurrencySelect } from '../../ui';
import { CurrencyInput } from '../../ui/CurrencyInput';
import { SwapButton } from './SwapButton';

type RateIndicator = 'up' | 'down';

interface ConverterBoxProps {
  amount: number;
  onAmountChange: (value: number) => void;
  fromCurrency: string;
  toCurrency: string;
  onFromCurrencyChange: (value: string) => void;
  onToCurrencyChange: (value: string) => void;
  currencies?: Currency[];
  isLoading?: boolean;
  error?: Error | null;
  resultAmount?: number | null;
  fromLabel?: ReactNode;
  toLabel?: ReactNode;
  fromMeta?: ReactNode;
  onSwap?: () => void;
  isSwapping?: boolean;
  amountPlaceholder?: string;
  amountClassName?: string;
  placeholder?: ReactNode;
  resultIndicator?: RateIndicator | null;
}

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
      className={`transition-all duration-300 ${isAnimating ? 'opacity-50 scale-95' : 'opacity-100 scale-100'} ${className}`}
    >
      {formatNumber(displayValue)}
    </span>
  );
}

export function ConverterBox({
  amount,
  onAmountChange,
  fromCurrency,
  toCurrency,
  onFromCurrencyChange,
  onToCurrencyChange,
  currencies,
  isLoading = false,
  error = null,
  resultAmount,
  fromLabel,
  toLabel,
  fromMeta,
  onSwap,
  isSwapping = false,
  amountPlaceholder = '0',
  amountClassName,
  placeholder = '—',
  resultIndicator,
}: ConverterBoxProps) {
  const { t } = useLanguage();
  const resolvedFromLabel = fromLabel ?? t('from') ?? 'From';
  const resolvedToLabel = toLabel ?? t('to') ?? 'To';

  return (
    <div className={`relative transition-all duration-300 ${isSwapping ? 'scale-[0.98]' : 'scale-100'}`}>
      {/* FROM Section - Top Half */}
      <div className="relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-t-3xl p-4 pb-6">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
            {resolvedFromLabel}
          </span>
          {fromMeta ? <div className="ml-auto">{fromMeta}</div> : null}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <CurrencyInput
            value={amount}
            onChange={onAmountChange}
            currencyCode={fromCurrency}
            currencySymbol={CURRENCY_SYMBOLS[fromCurrency]}
            placeholder={amountPlaceholder}
            className={amountClassName}
          />
          <CurrencySelect
            variant="inline"
            value={fromCurrency}
            onChange={onFromCurrencyChange}
            currencies={currencies}
          />
        </div>
      </div>

      {/* Swap Button - Coin Divider */}
      {onSwap && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <SwapButton onClick={onSwap} />
        </div>
      )}

      {/* TO Section - Bottom Half */}
      <div className="relative bg-slate-50 dark:bg-slate-800/50 border border-t-0 border-slate-200 dark:border-slate-700 rounded-b-3xl p-4 pt-6">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          {resolvedToLabel}
        </span>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 min-w-0 py-2 overflow-hidden">
            {isLoading ? (
              <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            ) : error ? (
              <span className="text-sm text-red-500">Error</span>
            ) : resultAmount !== undefined && resultAmount !== null ? (
              <div className="flex items-baseline gap-1 overflow-hidden">
                <span className="text-base text-slate-400 flex-shrink-0">
                  {CURRENCY_SYMBOLS[toCurrency] || ''}
                </span>
                <AnimatedNumber
                  value={resultAmount}
                  className="text-2xl sm:text-3xl font-semibold text-slate-800 dark:text-white tabular-nums truncate"
                />
                {resultIndicator && (
                  <div
                    className={`flex-shrink-0 ml-1 ${resultIndicator === 'up' ? 'text-emerald-500' : 'text-amber-500'}`}
                  >
                    {resultIndicator === 'up' ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-2xl text-slate-300 dark:text-slate-600">{placeholder}</span>
            )}
          </div>
          <CurrencySelect
            variant="inline"
            value={toCurrency}
            onChange={onToCurrencyChange}
            currencies={currencies}
          />
        </div>
      </div>
    </div>
  );
}
