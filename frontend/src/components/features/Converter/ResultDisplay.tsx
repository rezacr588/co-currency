import { useState } from 'react';
import type { ConversionResult } from '../../../types';
import { formatNumber, formatRate } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';
import { Skeleton } from '../../ui';
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
      // Fallback for older browsers
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
        className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center"
        role="alert"
        aria-live="assertive"
      >
        <p className="text-red-400 dark:text-red-300 text-sm mb-3">{t('failedToConvert')}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 dark:text-red-300 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50 min-h-[44px]"
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
      <div className="space-y-3" aria-busy="true" aria-label={t('converting')}>
        <Skeleton height={80} className="rounded-xl" />
        <p className="sr-only">{t('converting')}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-center text-slate-500 dark:text-slate-400 text-sm border border-dashed border-slate-300 dark:border-slate-700">
        {t('enterAmount')}
      </div>
    );
  }

  const fromFlag = CURRENCY_FLAGS[result.from] || '🌍';
  const toFlag = CURRENCY_FLAGS[result.to] || '🌍';
  const toSymbol = CURRENCY_SYMBOLS[result.to] || '';

  return (
    <div className="space-y-4" aria-live="polite" aria-atomic="true">
      {/* Main Result Card */}
      <div className="relative overflow-hidden p-6 bg-gradient-to-br from-primary-600/10 dark:from-primary-600/20 via-accent-600/5 dark:via-accent-600/10 to-primary-600/10 dark:to-primary-600/20 rounded-2xl border border-primary-500/20">
        {/* Background decoration */}
        <div className="absolute top-0 end-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 start-0 w-24 h-24 bg-accent-500/10 rounded-full blur-2xl" />

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute top-3 end-3 p-2 rounded-lg bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300/80 dark:hover:bg-slate-600/80 text-slate-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={t('copyResult')}
          title={t('copyResult')}
        >
          {copied ? (
            <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
        {copied && (
          <span className="absolute top-3 end-14 px-2 py-1 bg-green-500/20 text-green-500 text-xs rounded-lg" role="status">
            {t('copied')}
          </span>
        )}

        <div className="relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-200/80 dark:bg-slate-800/50 rounded-full text-sm text-slate-600 dark:text-slate-300 mb-3">
            <span>{fromFlag}</span>
            <span>{formatNumber(result.amount)}</span>
            <span className="font-medium">{result.from}</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl sm:text-4xl">{toFlag}</span>
            <div>
              <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-gradient leading-tight">
                {toSymbol}{formatNumber(result.result)}
              </p>
              <p className="text-base sm:text-lg font-medium text-slate-600 dark:text-slate-300">{result.to}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Rate Info */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-200/80 dark:bg-slate-800/50 rounded-full min-h-[44px]">
          <span>1 {result.from}</span>
          <span>=</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{formatRate(result.rate)}</span>
          <span>{result.to}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-200/80 dark:bg-slate-800/50 rounded-full min-h-[44px]">
          <span>1 {result.to}</span>
          <span>=</span>
          <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
            {result.rate > 0 ? formatRate(1 / result.rate) : '0'}
          </span>
          <span>{result.from}</span>
        </div>
      </div>
    </div>
  );
}
