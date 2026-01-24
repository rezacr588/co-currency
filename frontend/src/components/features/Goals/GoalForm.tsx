import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useMutationAction } from '../../../hooks';
import type { Goal, UpdateGoalRequest } from '../../../types/goal';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { GOAL_CATEGORIES } from '../../../types/goal';

interface GoalFormProps {
  goal?: Goal;
  onClose: () => void;
}

export function GoalForm({ goal, onClose }: GoalFormProps) {
  const { t } = useLanguage();
  const isEditing = !!goal;

  const [name, setName] = useState(goal?.name || '');
  const [targetAmount, setTargetAmount] = useState(goal?.target_amount?.toString() || '');
  const [currency, setCurrency] = useState(goal?.currency || 'USD');
  const [category, setCategory] = useState(goal?.category || '');
  const [deadline, setDeadline] = useState(goal?.deadline?.split('T')[0] || '');

  const { data: currenciesData } = useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
  });

  const createMutation = useMutationAction(api.goals.create, {
    successMessage: t('goalCreated' as any),
    invalidateQueries: [['goals']],
    onSuccess: onClose,
  });

  const updateMutation = useMutationAction(
    (data: UpdateGoalRequest) => {
      if (!goal) throw new Error('Cannot update: goal not found');
      return api.goals.update(goal.id, data);
    },
    {
      successMessage: t('goalUpdated' as any),
      invalidateQueries: [['goals']],
      onSuccess: onClose,
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedAmount = parseFloat(targetAmount) || 0;

    if (isEditing) {
      const updateData: UpdateGoalRequest = {};
      if (name !== goal.name) updateData.name = name;
      // Only update amount if it changed and is valid
      if (parsedAmount > 0 && parsedAmount !== goal.target_amount) {
        updateData.target_amount = parsedAmount;
      }
      if (category !== goal.category) updateData.category = category;
      if (deadline !== goal.deadline?.split('T')[0]) updateData.deadline = deadline || undefined;

      updateMutation.mutate(updateData);
    } else {
      createMutation.mutate({
        name,
        target_amount: parsedAmount,
        currency,
        category: category || undefined,
        deadline: deadline || undefined,
      });
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('goalName')}
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('enterGoalName')}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            {t('targetAmount')}
          </label>
          <Input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
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
                {c.code} - {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('category')} ({t('optional')})
        </label>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t('selectCategory')}</option>
          {GOAL_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`goalCategory_${cat}` as any) || cat}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t('deadline')} ({t('optional')})
        </label>
        <Input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isLoading} className="flex-1">
          {isLoading ? t('saving') : isEditing ? t('saveChanges') : t('createGoal')}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
