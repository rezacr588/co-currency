import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '../../../context/LanguageContext';
import { CurrencyBadge } from '../../ui/CurrencyBadge';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { api } from '../../../api/client';
import { useCurrencies } from '../../../hooks';
import type { Transaction, UpdateTransactionRequest } from '../../../types/wallet';
import { TRANSACTION_ICONS } from '../../../constants/icons';
import type { LucideIcon } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/format';

interface TransactionHistoryProps {
  transactions: Transaction[];
  showPagination?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  showActions?: boolean;
}

function formatTransactionDate(dateString: string): string {
  return formatDate(dateString, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Helper to find icon by name (case-insensitive)
function getIconByName(iconName: string): LucideIcon | null {
  if (!iconName) return null;
  const normalizedName = iconName.toLowerCase().trim();
  const found = TRANSACTION_ICONS.find(item => item.label.toLowerCase() === normalizedName);
  return found ? found.icon : null;
}

function getTransactionIcon(type: Transaction['type'], icon?: string) {
  // If custom icon is set, show it
  if (icon) {
    // Try to find matching Lucide icon by name
    const LucideIconComponent = getIconByName(icon);
    if (LucideIconComponent) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <LucideIconComponent className="w-4 h-4 text-slate-600 dark:text-slate-400" />
        </div>
      );
    }
    // Fallback: check if it's an emoji (starts with non-ASCII)
    const isEmoji = /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/u.test(icon);
    if (isEmoji) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg">
          {icon}
        </div>
      );
    }
    // If it's text that doesn't match any icon, use the first icon from the list as default
    const DefaultIcon = TRANSACTION_ICONS[0].icon;
    return (
      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <DefaultIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
      </div>
    );
  }

  switch (type) {
    case 'credit':
      return (
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-green-600 dark:text-green-400"
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
    case 'convert':
      return (
        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-primary-700 dark:text-primary-400"
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

interface IconPickerProps {
  selectedIcon: string;
  onSelect: (iconName: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

function IconPicker({ selectedIcon, onSelect, isOpen, onClose }: IconPickerProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return TRANSACTION_ICONS;
    const searchLower = search.toLowerCase().trim();
    return TRANSACTION_ICONS.filter(
      (icon) => icon.label.toLowerCase().includes(searchLower)
    );
  }, [search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={pickerRef}
      className="absolute z-10 mt-1 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
    >
      {/* Search */}
      <div className="p-2 border-b border-slate-100 dark:border-slate-700/50">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchIcon')}
          className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg py-2 px-3 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600/50"
        />
      </div>

      {/* Icon Grid */}
      <div className="p-2 grid grid-cols-3 gap-1 max-h-60 overflow-y-auto">
        {filteredIcons.length > 0 ? (
          filteredIcons.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                onSelect(label);
                onClose();
              }}
              className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                selectedIcon === label ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500' : ''
              }`}
            >
              <Icon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate w-full text-center">
                {label}
              </span>
            </button>
          ))
        ) : (
          <div className="col-span-3 py-4 text-center text-sm text-slate-500">
            {t('noIconsFound')}
          </div>
        )}
      </div>

      {/* Clear Button */}
      {selectedIcon && (
        <div className="p-2 border-t border-slate-100 dark:border-slate-700/50">
          <button
            type="button"
            onClick={() => {
              onSelect('');
              onClose();
            }}
            className="w-full py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            {t('clearIcon')}
          </button>
        </div>
      )}
    </div>
  );
}

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

function EditTransactionModal({ transaction, onClose, onSuccess }: EditTransactionModalProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: currencies } = useCurrencies();

  const [type, setType] = useState<'credit' | 'debit'>(
    transaction.type === 'credit' ? 'credit' : 'debit'
  );
  const [currency, setCurrency] = useState(transaction.currency);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [description, setDescription] = useState(transaction.description || '');
  const [icon, setIcon] = useState(transaction.icon || '');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: UpdateTransactionRequest) =>
      api.wallet.updateTransaction(transaction.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('updateFailed'));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError(t('invalidAmount'));
      return;
    }

    mutation.mutate({
      type,
      currency,
      amount: numAmount,
      icon: icon || undefined,
      description: description || undefined,
    });
  };

  const currencyOptions = currencies?.map((c) => ({
    value: c.code,
    label: `${c.code} - ${c.name}`,
  })) || [{ value: 'USD', label: 'USD - US Dollar' }];

  // Don't allow editing conversion transactions
  if (transaction.type === 'convert' || transaction.type === 'convert_from' || transaction.type === 'convert_to') {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
            {t('editTransaction')}
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {t('cannotEditConversion')}
          </p>
          <Button variant="secondary" onClick={onClose} className="w-full">
            {t('close')}
          </Button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
            {t('editTransaction')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorMessage>{error}</ErrorMessage>}

            {/* Transaction Type */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('transactionType')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('credit')}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                    type === 'credit'
                      ? 'bg-green-500 text-white shadow-lg shadow-green-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('credit')} (+)
                </button>
                <button
                  type="button"
                  onClick={() => setType('debit')}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                    type === 'debit'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {t('debit')} (-)
                </button>
              </div>
            </div>

            {/* Currency Select */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('currency')}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all"
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Icon Picker */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('transactionIcon')} ({t('optional')})
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all text-left flex items-center gap-3"
                  disabled={mutation.isPending}
                >
                  {icon ? (
                    (() => {
                      const SelectedIcon = getIconByName(icon);
                      return SelectedIcon ? (
                        <SelectedIcon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                      ) : (
                        <span className="text-2xl">{icon}</span>
                      );
                    })()
                  ) : (
                    <span className="text-slate-400 dark:text-slate-500">{t('selectIcon')}</span>
                  )}
                </button>
                <IconPicker
                  selectedIcon={icon}
                  onSelect={setIcon}
                  isOpen={showIconPicker}
                  onClose={() => setShowIconPicker(false)}
                />
              </div>
            </div>

            {/* Amount */}
            <Input
              type="number"
              label={t('amount')}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0.01"
              step="0.01"
              required
              disabled={mutation.isPending}
            />

            {/* Description */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('description')} ({t('optional')})
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('transactionDescription')}
                rows={3}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-primary-600/30 focus:border-primary-600 transition-all resize-none"
                disabled={mutation.isPending}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="flex-1"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? t('saving') : t('saveChanges')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface DeleteConfirmModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSuccess: () => void;
}

function DeleteConfirmModal({ transaction, onClose, onSuccess }: DeleteConfirmModalProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const typeLabels: Record<Transaction['type'], string> = {
    credit: t('credit'),
    debit: t('debit'),
    convert: t('convert'),
    convert_from: t('convertedFrom'),
    convert_to: t('convertedTo'),
  };

  const mutation = useMutation({
    mutationFn: () => api.wallet.deleteTransaction(transaction.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      onSuccess();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : t('deleteFailed'));
    },
  });

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">
          {t('confirmDelete')}
        </h2>

        {error && <ErrorMessage className="mb-4">{error}</ErrorMessage>}

        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {t('confirmDeleteTransaction')}
        </p>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            {getTransactionIcon(transaction.type, transaction.icon)}
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">
                {transaction.description || typeLabels[transaction.type]}
              </p>
              <p className={`text-sm font-semibold ${
                transaction.type === 'credit' ? 'text-green-600' : 'text-rose-600'
              }`}>
                {transaction.type === 'credit' ? '+' : '-'}
                {formatCurrency(transaction.amount, transaction.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            className="flex-1 bg-rose-600 hover:bg-rose-700"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t('deleting') : t('delete')}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

interface TransactionItemProps {
  transaction: Transaction;
  showActions?: boolean;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
}

function TransactionItem({ transaction, showActions, onEdit, onDelete }: TransactionItemProps) {
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

  const canEdit = transaction.type !== 'convert' && transaction.type !== 'convert_from' && transaction.type !== 'convert_to';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 group">
      {getTransactionIcon(transaction.type, transaction.icon)}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <CurrencyBadge code={transaction.currency} size="sm" />
          <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
            {transaction.description || typeLabel}
          </span>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {formatTransactionDate(transaction.created_at)}
        </span>
      </div>
      <div className="text-right flex items-center gap-2">
        <div>
          <span
            className={`text-sm font-semibold ${
              isPositive ? 'text-green-600 dark:text-green-400' : 'text-rose-600 dark:text-rose-400'
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
        {showActions && (
          <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <button
                onClick={() => onEdit?.(transaction)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                title={t('edit')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            <button
              onClick={() => onDelete?.(transaction)}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title={t('delete')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
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
  showActions = false,
}: TransactionHistoryProps) {
  const { t } = useLanguage();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
    return (
      <p className="text-center text-slate-500 dark:text-slate-400 py-8">{t('noTransactions')}</p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {transactions.map((transaction) => (
          <TransactionItem
            key={transaction.id}
            transaction={transaction}
            showActions={showActions}
            onEdit={setEditingTransaction}
            onDelete={setDeletingTransaction}
          />
        ))}
      </div>
      {showPagination && hasMore && (
        <div className="pt-4">
          <button
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="w-full py-2 text-sm text-primary-700 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium disabled:opacity-50"
          >
            {isLoadingMore ? t('loading') : t('loadMore')}
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSuccess={() => {}}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTransaction && (
        <DeleteConfirmModal
          transaction={deletingTransaction}
          onClose={() => setDeletingTransaction(null)}
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}
