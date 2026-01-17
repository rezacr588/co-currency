import { useLanguage } from '../../../context/LanguageContext';
import { CurrencyBadge } from '../../ui/CurrencyBadge';
import type { Transaction } from '../../../types/wallet';

interface TransactionHistoryProps {
  transactions: Transaction[];
  showPagination?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getTransactionIcon(type: Transaction['type']) {
  switch (type) {
    case 'credit':
      return (
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
      );
    case 'debit':
      return (
        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-rose-600 dark:text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </div>
      );
    case 'convert_from':
    case 'convert_to':
      return (
        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        </div>
      );
  }
}

function TransactionItem({ transaction }: { transaction: Transaction }) {
  const { t } = useLanguage();

  const isPositive = transaction.type === 'credit' || transaction.type === 'convert_to';
  const typeLabels: Record<Transaction['type'], string> = {
    credit: t('credit'),
    debit: t('debit'),
    convert: t('convert'),
    convert_from: t('convertedFrom'),
    convert_to: t('convertedTo'),
  };
  const typeLabel = typeLabels[transaction.type];

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0">
      {getTransactionIcon(transaction.type)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <CurrencyBadge code={transaction.currency} size="sm" />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
            {transaction.description || typeLabel}
          </span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatDate(transaction.created_at)}
        </span>
      </div>
      <div className="text-right">
        <span
          className={`text-sm font-semibold ${
            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {isPositive ? '+' : '-'}
          {formatCurrency(Math.abs(transaction.amount), transaction.currency)}
        </span>
        {transaction.balance_after !== undefined && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('balance')}: {formatCurrency(transaction.balance_after, transaction.currency)}
          </p>
        )}
      </div>
    </div>
  );
}

export function TransactionHistory({
  transactions,
  showPagination = false,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: TransactionHistoryProps) {
  const { t } = useLanguage();

  if (transactions.length === 0) {
    return (
      <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noTransactions')}</p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {transactions.map((transaction) => (
          <TransactionItem key={transaction.id} transaction={transaction} />
        ))}
      </div>
      {showPagination && hasMore && (
        <div className="pt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium disabled:opacity-50"
          >
            {isLoadingMore ? t('loading') : t('loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
