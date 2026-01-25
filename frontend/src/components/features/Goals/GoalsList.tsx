import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import type { Goal } from '../../../types/goal';
import { Container } from '../../layout';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { Modal } from '../../ui/Modal';
import { GoalCard } from './GoalCard';
import { GoalForm } from './GoalForm';
import { ROUTES } from '../../../constants/routes';

export function GoalsList() {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.goals.list(),
  });

  const goals = data?.goals || [];
  const activeGoals = goals.filter((g) => !g.is_completed);
  const completedGoals = goals.filter((g) => g.is_completed);

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingGoal(undefined);
  };

  // Calculate total progress across all active goals
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.target_amount, 0);
  const totalCurrent = activeGoals.reduce((sum, g) => sum + g.current_amount, 0);
  const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('financialGoals')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{t('goalsDescription')}</p>
            </div>
            <div className="flex gap-2">
              <Link to={ROUTES.wallet}>
                <Button variant="ghost" size="sm">
                  {t('backToWallet')}
                </Button>
              </Link>
              <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
                {t('createGoal')}
              </Button>
            </div>
          </div>

          {/* Goal Form Modal */}
          <Modal
            isOpen={showForm}
            onClose={handleCloseForm}
            title={editingGoal ? t('editGoal') : t('createGoal')}
            size="md"
          >
            <GoalForm goal={editingGoal} onClose={handleCloseForm} />
          </Modal>

          {/* Summary Card */}
          {activeGoals.length > 0 && (
            <Card variant="gradient">
              <CardContent className="py-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {t('overallProgress')}
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-4xl font-bold bg-gradient-to-r from-primary-700 to-primary-700 dark:from-primary-500 dark:to-primary-500 bg-clip-text text-transparent">
                      {overallProgress.toFixed(1)}%
                    </div>
                    <div className="text-left">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {activeGoals.length} {t('activeGoals')}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {completedGoals.length} {t('completedGoals')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Goals List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : error ? (
            <ErrorMessage onRetry={refetch}>{t('failedToLoadGoals')}</ErrorMessage>
          ) : goals.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex justify-center mb-4">
                  <Target className="w-12 h-12 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  {t('noGoalsYet')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {t('noGoalsDescription')}
                </p>
                <Button variant="primary" onClick={() => setShowForm(true)}>
                  {t('createFirstGoal')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Active Goals */}
              {activeGoals.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                    {t('activeGoals')} ({activeGoals.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeGoals.map((goal) => (
                      <GoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Goals */}
              {completedGoals.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                    {t('completedGoals')} ({completedGoals.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {completedGoals.map((goal) => (
                      <GoalCard key={goal.id} goal={goal} onEdit={handleEdit} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
