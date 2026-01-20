import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import type { Budget } from '../../../types/goal';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { CATEGORY_ICONS } from '../../../constants/icons';
import { formatCurrency } from '../../../utils/format';

interface BudgetCardProps {
  budget: Budget;
  onEdit: (budget: Budget) => void;
}

export function BudgetCard({ budget, onEdit }: BudgetCardProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.budgets.delete(budget.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });

  const getProgressColor = () => {
    if (budget.is_over_budget) return 'bg-red-500';
    if (budget.is_near_limit) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusColor = () => {
    if (budget.is_over_budget) return 'text-red-500';
    if (budget.is_near_limit) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Card className={`${budget.is_over_budget ? 'ring-2 ring-red-500' : budget.is_near_limit ? 'ring-2 ring-yellow-500' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {(() => {
              const IconComponent = CATEGORY_ICONS[budget.category] || CATEGORY_ICONS.other;
              return <IconComponent className="w-6 h-6 text-primary-600 dark:text-primary-400" />;
            })()}
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
                {t(`category_${budget.category}` as any) || budget.category}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {t(budget.period)}
              </p>
            </div>
          </div>
          {budget.is_over_budget && (
            <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
              {t('overBudget')}
            </span>
          )}
          {budget.is_near_limit && !budget.is_over_budget && (
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full">
              {t('nearLimit')}
            </span>
          )}
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500 dark:text-slate-400">
              {t('spent')}: {formatCurrency(budget.spent, budget.currency)}
            </span>
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {formatCurrency(budget.amount, budget.currency)}
            </span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-2 ${getProgressColor()} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(budget.progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className={getStatusColor()}>
              {budget.progress.toFixed(1)}%
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {t('remaining')}: {formatCurrency(Math.max(budget.remaining, 0), budget.currency)}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => onEdit(budget)} className="flex-1">
            {t('edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(t('confirmDeleteBudget'))) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="text-red-500 hover:text-red-600"
          >
            {t('delete')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
