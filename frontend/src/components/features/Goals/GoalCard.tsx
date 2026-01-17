import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import type { Goal } from '../../../types/goal';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { GoalProgress } from './GoalProgress';

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
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
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const categoryIcons: Record<string, string> = {
  savings: '💰',
  emergency_fund: '🚨',
  vacation: '✈️',
  home: '🏠',
  car: '🚗',
  education: '📚',
  retirement: '👴',
  investment: '📈',
  debt_payoff: '💳',
  other: '🎯',
};

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isContributing, setIsContributing] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');

  const contributeMutation = useMutation({
    mutationFn: (amount: number) => api.goals.contribute(goal.id, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
      setIsContributing(false);
      setContributeAmount('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.goals.delete(goal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });

  const handleContribute = () => {
    const amount = parseFloat(contributeAmount);
    if (amount > 0) {
      contributeMutation.mutate(amount);
    }
  };

  const remainingAmount = goal.target_amount - goal.current_amount;
  const isOverdue = goal.deadline && new Date(goal.deadline) < new Date() && !goal.is_completed;

  return (
    <Card className={`${goal.is_completed ? 'ring-2 ring-green-500' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{categoryIcons[goal.category || 'other']}</span>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{goal.name}</h3>
              {goal.deadline && (
                <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                  {t('deadline')}: {formatDate(goal.deadline)}
                  {isOverdue && ` (${t('overdue')})`}
                </p>
              )}
            </div>
          </div>
          {goal.is_completed && (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
              {t('completed')}
            </span>
          )}
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500 dark:text-slate-400">
              {formatCurrency(goal.current_amount, goal.currency)}
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(goal.target_amount, goal.currency)}
            </span>
          </div>
          <GoalProgress progress={goal.progress} isCompleted={goal.is_completed} />
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500 dark:text-slate-400">
              {goal.progress.toFixed(1)}%
            </span>
            {!goal.is_completed && (
              <span className="text-slate-500 dark:text-slate-400">
                {t('remaining')}: {formatCurrency(remainingAmount, goal.currency)}
              </span>
            )}
          </div>
        </div>

        {isContributing ? (
          <div className="space-y-2">
            <Input
              type="number"
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              placeholder={t('enterAmount')}
              min="0"
              step="0.01"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleContribute}
                disabled={contributeMutation.isPending || !contributeAmount}
                className="flex-1"
              >
                {contributeMutation.isPending ? t('contributing') : t('contribute')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsContributing(false);
                  setContributeAmount('');
                }}
              >
                {t('cancel')}
              </Button>
            </div>
            {contributeMutation.isError && (
              <p className="text-xs text-red-500">{t('contributionFailed')}</p>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            {!goal.is_completed && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setIsContributing(true)}
                className="flex-1"
              >
                {t('contribute')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onEdit(goal)}>
              {t('edit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(t('confirmDeleteGoal'))) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              className="text-red-500 hover:text-red-600"
            >
              {t('delete')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
