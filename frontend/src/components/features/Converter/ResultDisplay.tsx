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
        className="p-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-center animate-fade-in"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-red-600 dark:text-red-400 text-sm mb-4">{t('failedToConvert')}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-2.5 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/30"
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
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={t('converting')}>
        <div className="h-32 bg-slate-100 dark:bg-slate-800/50 rounded-2xl" />
        <div className="flex justify-center gap-3">
          <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800/50 rounded-full" />
          <div className="h-10 w-32 bg-slate-100 dark:bg-slate-800/50 rounded-full" />
        </div>
        <p className="sr-only">{t('converting')}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-8 bg-slate-50 dark:bg-slate-800/30 rounded-2xl text-center border-2 border-dashed border-slate-200 dark:border-slate-700/50">
        <p className="text-slate-400 dark:text-slate-500 text-sm font-light">{t('enterAmount')}</p>
      </div>
    );
  }

  const fromFlag = CURRENCY_FLAGS[result.from] || '🌍';
  const toFlag = CURRENCY_FLAGS[result.to] || '🌍';
  const toSymbol = CURRENCY_SYMBOLS[result.to] || '';

  return (
    <div className="space-y-4 animate-fade-in" aria-live="polite" aria-atomic="true">
      {/* Main Result Card */}
      <div className="relative overflow-hidden p-8 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-4 end-4 p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          aria-label={t('copyResult')}
          title={t('copyResult')}
        >
          {copied ? (
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>

        {copied && (
          <span className="absolute top-4 end-16 px-3 py-1.5 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-medium rounded-lg animate-fade-in" role="status">
            {t('copied')}
          </span>
        )}

        <div className="text-center space-y-4">
          {/* From amount */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-slate-800/40 backdrop-blur-sm rounded-full text-sm text-slate-600 dark:text-slate-300">
            <span className="text-lg">{fromFlag}</span>
            <span className="font-medium">{formatNumber(result.amount)}</span>
            <span className="text-slate-400">{result.from}</span>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <svg className="w-5 h-5 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>

          {/* Result */}
          <div className="flex items-center justify-center gap-4">
            <span className="text-4xl sm:text-5xl">{toFlag}</span>
            <div>
              <p className="text-4xl sm:text-5xl md:text-6xl font-light text-gradient leading-none tracking-tight">
                {toSymbol}{formatNumber(result.result)}
              </p>
              <p className="text-lg font-light text-slate-500 dark:text-slate-400 mt-1">{result.to}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Rate Info */}
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-full text-slate-500 dark:text-slate-400">
          <span>1 {result.from}</span>
          <span className="text-slate-300 dark:text-slate-600">=</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatRate(result.rate)}</span>
          <span>{result.to}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-full text-slate-500 dark:text-slate-400">
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
