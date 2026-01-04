import type { ConversionResult } from '../../../types';
import { formatNumber, formatRate } from '../../../utils/format';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from '../../../utils/constants';
import { Skeleton } from '../../ui';

interface ResultDisplayProps {
  result?: ConversionResult;
  isLoading: boolean;
  error: Error | null;
}

export function ResultDisplay({ result, isLoading, error }: ResultDisplayProps) {
  if (error) {
    return (
      <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
        Failed to convert. Please try again.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <Skeleton height={60} className="rounded-lg" />
        <Skeleton height={24} width="50%" className="mx-auto rounded" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="mt-6 p-6 bg-slate-700/30 rounded-lg text-center text-slate-400">
        Enter an amount to see the conversion
      </div>
    );
  }

  const fromFlag = CURRENCY_FLAGS[result.from] || '';
  const toFlag = CURRENCY_FLAGS[result.to] || '';
  const toSymbol = CURRENCY_SYMBOLS[result.to] || '';

  return (
    <div className="mt-6 space-y-4">
      <div className="p-6 bg-gradient-to-br from-primary-600/20 to-accent-600/20 rounded-xl border border-primary-500/30">
        <div className="text-center">
          <p className="text-sm text-slate-400 mb-2">
            {fromFlag} {formatNumber(result.amount)} {result.from} =
          </p>
          <p className="text-4xl font-bold text-gradient">
            {toFlag} {toSymbol}{formatNumber(result.result)}
          </p>
          <p className="text-lg font-medium text-slate-300 mt-1">
            {result.to}
          </p>
        </div>
      </div>

      <div className="text-center text-sm text-slate-400">
        <p>
          1 {result.from} = {formatRate(result.rate)} {result.to}
        </p>
        <p className="mt-1">
          1 {result.to} = {formatRate(1 / result.rate)} {result.from}
        </p>
      </div>
    </div>
  );
}
