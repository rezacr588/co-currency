import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useMutationAction } from '../../../hooks';
import type { RecurringTransaction, UpdateRecurringRequest } from '../../../types/goal';
import { DEFAULT_CATEGORIES } from '../../../types/wallet';
import { RECURRING_FREQUENCIES } from '../../../types/goal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

interface RecurringFormProps {
  recurring?: RecurringTransaction;
  onClose: () => void;
}

export function RecurringForm({ recurring, onClose }: RecurringFormProps) {
  const { t } = useLanguage();
  const isEditing = !!recurring;

  const [type, setType] = useState<'credit' | 'debit'>(recurring?.type || 'debit');
  const [amount, setAmount] = useState(recurring?.amount?.toString() || '');
  const [currency, setCurrency] = useState(recurring?.currency || 'USD');
  const [category, setCategory] = useState(recurring?.category || '');
  const [description, setDescription] = useState(recurring?.description || '');
  const [frequency, setFrequency] = useState(recurring?.frequency || 'monthly');
  const [nextExecution, setNextExecution] = useState(
    recurring?.next_execution?.split('T')[0] || new Date().toISOString().split('T')[0]
  );

  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
  });

  const createMutation = useMutationAction(api.recurring.create, {
    successMessage: t('recurringCreated' as any),
    invalidateQueries: [['recurring']],
    onSuccess: onClose,
  });

  const updateMutation = useMutationAction(
    (data: UpdateRecurringRequest) => {
      if (!recurring) throw new Error('Cannot update: recurring transaction not found');
      return api.recurring.update(recurring.id, data);
    },
    {
      successMessage: t('recurringUpdated' as any),
      invalidateQueries: [['recurring']],
      onSuccess: onClose,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditing) {
      const updateData: UpdateRecurringRequest = {};
      if (type !== recurring.type) updateData.type = type;
      if (parseFloat(amount) !== recurring.amount) updateData.amount = parseFloat(amount);
      if (category !== recurring.category) updateData.category = category;
      if (description !== recurring.description) updateData.description = description;
      if (frequency !== recurring.frequency) updateData.frequency = frequency as any;
      if (nextExecution !== recurring.next_execution?.split('T')[0]) updateData.next_execution = nextExecution;

      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate({
        type,
        amount: parseFloat(amount),
        currency,
        category: category || undefined,
        description: description || undefined,
        frequency: frequency as any,
        next_execution: nextExecution,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('transactionType')}
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={type === 'credit' ? 'primary' : 'ghost'}
            onClick={() => setType('credit')}
            className="flex-1"
          >
            {t('credit')}
          </Button>
          <Button
            type="button"
            variant={type === 'debit' ? 'primary' : 'ghost'}
            onClick={() => setType('debit')}
            className="flex-1"
          >
            {t('debit')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('amount')}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('frequency')}
          </label>
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
            {RECURRING_FREQUENCIES.map((freq) => (
              <option key={freq} value={freq}>
                {t(`frequency_${freq}` as any) || freq}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('nextExecution')}
          </label>
          <Input
            type="date"
            value={nextExecution}
            onChange={(e) => setNextExecution(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('category')} ({t('optional')})
        </label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('selectCategory')}</option>
          {DEFAULT_CATEGORIES.map((cat) => (
            <option key={cat.name} value={cat.name}>
              {cat.icon} {t(`category_${cat.name}` as any) || cat.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('description')} ({t('optional')})
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('transactionDescription')}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isLoading} className="flex-1">
          {isLoading ? t('saving') : isEditing ? t('saveChanges') : t('createRecurring')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
