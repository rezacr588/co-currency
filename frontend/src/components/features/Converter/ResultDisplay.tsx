import type { ConversionResult } from '../../../types';
import { formatNumber, formatRate } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';
import { Skeleton } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';

interface ResultDisplayProps {
  result?: ConversionResult;
  isLoading: boolean;
  error: Error | null;
}

export function ResultDisplay({ result, isLoading, error }: ResultDisplayProps) {
  const { t } = useLanguage();

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center text-sm">
        {t('failedToConvert')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton height={80} className="rounded-xl" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="p-6 bg-slate-800/50 rounded-xl text-center text-slate-400 text-sm border border-dashed border-slate-700">
        {t('enterAmount')}
      </div>
    );
  }

  const fromFlag = CURRENCY_FLAGS[result.from] || '🌍';
  const toFlag = CURRENCY_FLAGS[result.to] || '🌍';
  const toSymbol = CURRENCY_SYMBOLS[result.to] || '';

  return (
    <div className="space-y-4">
      {/* Main Result Card */}
      <div className="relative overflow-hidden p-6 bg-gradient-to-br from-primary-600/20 via-accent-600/10 to-primary-600/20 rounded-2xl border border-primary-500/20">
        {/* Background decoration */}
        <div className="absolute top-0 end-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 start-0 w-24 h-24 bg-accent-500/10 rounded-full blur-2xl" />

        <div className="relative text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-full text-sm text-slate-300 mb-3">
            <span>{fromFlag}</span>
            <span>{formatNumber(result.amount)}</span>
            <span className="font-medium">{result.from}</span>
          </div>

          <div className="flex items-center justify-center gap-3">
            <span className="text-3xl">{toFlag}</span>
            <div>
              <p className="text-4xl sm:text-5xl font-bold text-gradient leading-tight">
                {toSymbol}{formatNumber(result.result)}
              </p>
              <p className="text-lg font-medium text-slate-300">{result.to}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Rate Info */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-full">
          <span>1 {result.from}</span>
          <span>=</span>
          <span className="font-mono font-medium text-slate-300">{formatRate(result.rate)}</span>
          <span>{result.to}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 rounded-full">
          <span>1 {result.to}</span>
          <span>=</span>
          <span className="font-mono font-medium text-slate-300">
            {result.rate > 0 ? formatRate(1 / result.rate) : '0'}
          </span>
          <span>{result.from}</span>
        </div>
      </div>
    </div>
  );
}
