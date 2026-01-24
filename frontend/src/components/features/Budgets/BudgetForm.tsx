import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useMutationAction } from '../../../hooks';
import type { Budget, UpdateBudgetRequest } from '../../../types/goal';
import { DEFAULT_CATEGORIES } from '../../../types/wallet';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

interface BudgetFormProps {
  budget?: Budget;
  onClose: () => void;
}

export function BudgetForm({ budget, onClose }: BudgetFormProps) {
  const { t } = useLanguage();
  const isEditing = !!budget;

  const [category, setCategory] = useState(budget?.category || '');
  const [amount, setAmount] = useState(budget?.amount?.toString() || '');
  const [currency, setCurrency] = useState(budget?.currency || 'USD');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>(budget?.period || 'monthly');

  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
  });

  const createMutation = useMutationAction(api.budgets.create, {
    successMessage: t('budgetCreated' as any),
    invalidateQueries: [['budgets']],
    onSuccess: onClose,
  });

  const updateMutation = useMutationAction(
    (data: UpdateBudgetRequest) => {
      if (!budget) throw new Error('Cannot update: budget not found');
      return api.budgets.update(budget.id, data);
    },
    {
      successMessage: t('budgetUpdated' as any),
      invalidateQueries: [['budgets']],
      onSuccess: onClose,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(amount) || 0;

    if (isEditing) {
      const updateData: UpdateBudgetRequest = {};
      // Only update amount if it changed and is valid
      if (parsedAmount > 0 && parsedAmount !== budget.amount) {
        updateData.amount = parsedAmount;
      }
      if (period !== budget.period) updateData.period = period;

      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate({
        category,
        amount: parsedAmount,
        currency,
        period,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('category')}
        </label>
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isEditing}
          required
        >
          <option value="">{t('selectCategory')}</option>
          {DEFAULT_CATEGORIES.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {t(`category_${cat.name}` as any) || cat.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('budgetAmount')}
          </label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('currency')}
          </label>
          <Select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            disabled={isEditing}
          >
            {currenciesData?.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('period')}
        </label>
        <Select value={period} onChange={(e) => setPeriod(e.target.value as 'monthly' | 'yearly')}>
          <option value="monthly">{t('monthly')}</option>
          <option value="yearly">{t('yearly')}</option>
        </Select>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isLoading} className="flex-1">
          {isLoading ? t('saving') : isEditing ? t('saveChanges') : t('createBudget')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
