import { useState } from 'react';
import { Button, Input, Select } from '../../ui';
import { useLanguage } from '../../../context/LanguageContext';
import { api } from '../../../api';
import { DEFAULT_CATEGORIES } from '../../../types/wallet';

interface FirstTransactionProps {
  currency: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

export function FirstTransaction({
  currency,
  onNext,
  onBack,
  onSkip,
}: FirstTransactionProps) {
  const { t } = useLanguage();
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('income');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setIsLoading(true);

    try {
      await api.wallet.addTransaction({
        type,
        amount: parseFloat(amount),
        currency,
        category,
        description: description || `Initial ${type}`,
      });
      onNext();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {t('addFirstTransaction') || 'Add Your First Transaction'}
        </h2>
        <p className="text-slate-600 dark:text-slate-400">
          {t('firstTransactionDesc') ||
            "Start by adding your current balance or a recent transaction."}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transaction Type */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setType('credit')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              type === 'credit'
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="text-xl mr-2">+</span>
            {t('credit') || 'Income / Credit'}
          </button>
          <button
            type="button"
            onClick={() => setType('debit')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              type === 'debit'
                ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="text-xl mr-2">-</span>
            {t('debit') || 'Expense / Debit'}
          </button>
        </div>

        {/* Amount */}
        <Input
          label={t('amount') || 'Amount'}
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />

        {/* Currency display */}
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <span>{t('currency') || 'Currency'}:</span>
          <span className="font-medium text-slate-900 dark:text-white">{currency}</span>
        </div>

        {/* Category */}
        <Select
          label={t('category') || 'Category'}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {DEFAULT_CATEGORIES.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {cat.name.charAt(0).toUpperCase() + cat.name.slice(1)}
            </option>
          ))}
        </Select>

        {/* Description */}
        <Input
          label={t('description') || 'Description (optional)'}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder') || 'e.g., Salary, Groceries...'}
        />

        <div className="flex justify-between pt-4">
          <Button type="button" variant="secondary" onClick={onBack}>
            {t('back') || 'Back'}
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onSkip}>
              {t('skipForNow') || 'Skip for now'}
            </Button>
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? 'Adding...' : t('addTransaction') || 'Add Transaction'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
