import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PieChart } from 'lucide-react';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import type { Budget } from '../../../types/goal';
import { Container } from '../../layout';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Skeleton } from '../../ui/Skeleton';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { BudgetCard } from './BudgetCard';
import { BudgetForm } from './BudgetForm';

export function BudgetList() {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingGoal] = useState<Budget | undefined>(undefined);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
  });

  const budgets = data?.budgets || [];

  const handleEdit = (budget: Budget) => {
    setEditingGoal(budget);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingGoal(undefined);
  };

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('budgets')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{t('budgetsDescription')}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/wallet">
                <Button variant="ghost" size="sm">
                  {t('backToWallet')}
                </Button>
              </Link>
              <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
                {t('createBudget')}
              </Button>
            </div>
          </div>

          <Modal
            isOpen={showForm}
            onClose={handleCloseForm}
            title={editingBudget ? t('editBudget') : t('createBudget')}
            size="md"
          >
            <BudgetForm budget={editingBudget} onClose={handleCloseForm} />
          </Modal>

          {/* Budgets List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : error ? (
            <ErrorMessage onRetry={refetch}>{t('failedToLoadBudgets')}</ErrorMessage>
          ) : budgets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex justify-center mb-4">
                  <PieChart className="w-12 h-12 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  {t('noBudgetsYet')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {t('noBudgetsDescription')}
                </p>
                <Button variant="primary" onClick={() => setShowForm(true)}>
                  {t('createFirstBudget')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {budgets.map((budget) => (
                <BudgetCard key={budget.id} budget={budget} onEdit={handleEdit} />
              ))}
            </div>
          )}
        </div>
      </Container>
    </main>
  );
}
