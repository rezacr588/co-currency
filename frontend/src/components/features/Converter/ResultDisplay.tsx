import { useState } from 'react';
import type { ConversionResult } from '../../../types';
import { formatNumber, formatRate } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';
import { useLanguage } from '../../../context/LanguageContext';

interface ResultDisplayProps {
  result?: ConversionResult;
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
}

export function ResultDisplay({ result, isLoading, error, onRetry }: ResultDisplayProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result) return;
    const text = `${formatNumber(result.amount)} ${result.from} = ${formatNumber(result.result)} ${result.to}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (error) {
    return (
      <div
        className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-center animate-fade-in"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-red-600 dark:text-red-400 text-sm mb-3">{t('failedToConvert')}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/30"
            aria-label={t('retry')}
          >
            {t('retry')}
          </button>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse" aria-busy="true" aria-label={t('converting')}>
        <div className="h-24 bg-slate-100 dark:bg-slate-800/50 rounded-xl" />
        <div className="flex justify-center gap-2">
          <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800/50 rounded-full" />
          <div className="h-8 w-28 bg-slate-100 dark:bg-slate-800/50 rounded-full" />
        </div>
        <p className="sr-only">{t('converting')}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6 bg-slate-50 dark:bg-slate-800/30 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
        <p className="text-slate-400 dark:text-slate-500 text-sm">{t('enterAmount')}</p>
      </div>
    );
  }

  const fromFlag = CURRENCY_FLAGS[result.from] || '🌍';
  const toFlag = CURRENCY_FLAGS[result.to] || '🌍';
  const toSymbol = CURRENCY_SYMBOLS[result.to] || '';

  return (
    <div className="space-y-3 animate-fade-in" aria-live="polite" aria-atomic="true">
      {/* Main Result Card */}
      <div className="relative p-5 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 rounded-xl border border-indigo-100/50 dark:border-indigo-500/20">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 end-3 p-2 rounded-lg bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          aria-label={t('copyResult')}
          title={t('copyResult')}
        >
          {copied ? (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {copied && (
          <span className="absolute top-3 end-12 px-2 py-1 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium rounded-md animate-fade-in" role="status">
            {t('copied')}
          </span>
        )}

        <div className="text-center space-y-2">
          {/* From amount - inline */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/50 dark:bg-slate-800/30 rounded-full text-xs text-slate-600 dark:text-slate-300">
            <span className="text-base">{fromFlag}</span>
            <span className="font-medium">{formatNumber(result.amount)}</span>
            <span className="text-slate-400">{result.from}</span>
            <span className="text-slate-300 dark:text-slate-600 mx-1">=</span>
          </div>

          {/* Result */}
          <div className="flex items-center justify-center gap-3 pt-1">
            <span className="text-3xl sm:text-4xl">{toFlag}</span>
            <div>
              <p className="text-3xl sm:text-4xl font-light text-gradient leading-none tracking-tight">
                {toSymbol}{formatNumber(result.result)}
              </p>
              <p className="text-sm font-light text-slate-500 dark:text-slate-400 mt-0.5">{result.to}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Rate Info - Compact */}
      <div className="flex flex-wrap justify-center gap-2 text-[11px]">
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
    </div>
  );
}
