import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../../../types/goal';
import { DEFAULT_CATEGORIES } from '../../../types/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

interface BudgetFormProps {
  budget?: Budget;
  onClose: () => void;
}

export function BudgetForm({ budget, onClose }: BudgetFormProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isEditing = !!budget;

  const [category, setCategory] = useState(budget?.category || '');
  const [amount, setAmount] = useState(budget?.amount?.toString() || '');
  const [currency, setCurrency] = useState(budget?.currency || 'USD');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>(budget?.period || 'monthly');

  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateBudgetRequest) => api.budgets.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateBudgetRequest) => {
      if (!budget) throw new Error('Cannot update: budget not found');
      return api.budgets.update(budget.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      const updateData: UpdateBudgetRequest = {};
      if (parseFloat(amount) !== budget.amount) updateData.amount = parseFloat(amount);
      if (period !== budget.period) updateData.period = period;

      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate({
        category,
        amount: parseFloat(amount),
        currency,
        period,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const error = createMutation.error || updateMutation.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? t('editBudget') : t('createBudget')}</CardTitle>
      </CardHeader>
      <CardContent>
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
                  {cat.icon} {t(`category_${cat.name}` as any) || cat.name}
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
                min="0"
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

          {error && (
            <p className="text-sm text-red-500">{t('budgetSaveFailed')}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={isLoading} className="flex-1">
              {isLoading ? t('saving') : isEditing ? t('saveChanges') : t('createBudget')}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
