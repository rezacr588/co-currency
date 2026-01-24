import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import type { RecurringTransaction } from '../../../types/goal';
import { Container } from '../../layout';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { Skeleton } from '../../ui/Skeleton';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { RecurringForm } from './RecurringForm';
import { CATEGORY_ICONS, FREQUENCY_ICONS } from '../../../constants/icons';
import { formatCurrency, formatDate } from '../../../utils/format';

function formatRecurringDate(dateString: string): string {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}


interface RecurringCardProps {
  recurring: RecurringTransaction;
  onEdit: (recurring: RecurringTransaction) => void;
}

function RecurringCard({ recurring, onEdit }: RecurringCardProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.recurring.delete(recurring.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => api.recurring.execute(recurring.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.recurring.update(recurring.id, { is_active: !recurring.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
    },
  });

  const isDue = new Date(recurring.next_execution) <= new Date();

  return (
    <Card className={`${!recurring.is_active ? 'opacity-60' : ''} ${isDue && recurring.is_active ? 'ring-2 ring-primary-600' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {(() => {
              const IconComponent = CATEGORY_ICONS[recurring.category || 'other'] || CATEGORY_ICONS.other;
              return <IconComponent className="w-6 h-6 text-primary-600 dark:text-primary-400" />;
            })()}
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                {recurring.description || t(`category_${recurring.category}` as any) || recurring.category || t('recurring')}
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {(() => {
                  const FreqIcon = FREQUENCY_ICONS[recurring.frequency] || FREQUENCY_ICONS.monthly;
                  return <FreqIcon className="w-3.5 h-3.5" />;
                })()}
                <span className="capitalize">{t(`frequency_${recurring.frequency}` as any) || recurring.frequency}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-lg font-semibold ${recurring.type === 'credit' ? 'text-green-500' : 'text-red-500'}`}>
              {recurring.type === 'credit' ? '+' : '-'}
              {formatCurrency(recurring.amount, recurring.currency)}
            </span>
            {!recurring.is_active && (
              <span className="block text-xs text-slate-500">{t('paused')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-500 dark:text-slate-400">{t('nextExecution')}</span>
          <span className={`text-sm font-medium ${isDue ? 'text-primary-600' : 'text-slate-700 dark:text-slate-200'}`}>
            {formatRecurringDate(recurring.next_execution)}
            {isDue && ` (${t('due')})`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDue && recurring.is_active && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => executeMutation.mutate()}
              disabled={executeMutation.isPending}
            >
              {executeMutation.isPending ? t('executing') : t('executeNow')}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => toggleMutation.mutate()}
            disabled={toggleMutation.isPending}
          >
            {recurring.is_active ? t('pause') : t('resume')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onEdit(recurring)}>
            {t('edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(t('confirmDeleteRecurring'))) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="text-red-500 hover:text-red-600"
          >
            {t('delete')}
          </Button>
        </div>

        {executeMutation.isError && (
          <p className="text-xs text-red-500 mt-2">{t('executionFailed')}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function RecurringList() {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | undefined>(undefined);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['recurring'],
    queryFn: () => api.recurring.list(),
  });

  const recurringTransactions = data?.recurring_transactions || [];
  const activeRecurring = recurringTransactions.filter((r) => r.is_active);
  const pausedRecurring = recurringTransactions.filter((r) => !r.is_active);
  const dueCount = activeRecurring.filter((r) => new Date(r.next_execution) <= new Date()).length;

  const handleEdit = (recurring: RecurringTransaction) => {
    setEditingRecurring(recurring);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRecurring(undefined);
  };

  return (
    <main className="flex-1 py-4 sm:py-6">
      <Container>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {t('recurringTransactions')}
              </h1>
              <p className="text-slate-500 dark:text-slate-400">{t('recurringDescription')}</p>
            </div>
            <div className="flex gap-2">
              <Link to="/wallet">
                <Button variant="ghost" size="sm">
                  {t('backToWallet')}
                </Button>
              </Link>
              <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
                {t('createRecurring')}
              </Button>
            </div>
          </div>

          <Modal
            isOpen={showForm}
            onClose={handleCloseForm}
            title={editingRecurring ? t('editRecurring') : t('createRecurring')}
            size="md"
          >
            <RecurringForm recurring={editingRecurring} onClose={handleCloseForm} />
          </Modal>

          {/* Summary Card */}
          {recurringTransactions.length > 0 && (
            <Card variant="gradient">
              <CardContent className="py-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('activeRecurring')}</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {activeRecurring.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('pausedRecurring')}</p>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {pausedRecurring.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('dueNow')}</p>
                    <p className={`text-2xl font-bold ${dueCount > 0 ? 'text-primary-600' : 'text-slate-800 dark:text-slate-100'}`}>
                      {dueCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recurring List */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : error ? (
            <ErrorMessage onRetry={refetch}>{t('failedToLoadRecurring')}</ErrorMessage>
          ) : recurringTransactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="flex justify-center mb-4">
                  <Repeat className="w-12 h-12 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  {t('noRecurringYet')}
                </h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {t('noRecurringDescription')}
                </p>
                <Button variant="primary" onClick={() => setShowForm(true)}>
                  {t('createFirstRecurring')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Active Recurring */}
              {activeRecurring.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                    {t('activeRecurring')} ({activeRecurring.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeRecurring.map((recurring) => (
                      <RecurringCard key={recurring.id} recurring={recurring} onEdit={handleEdit} />
                    ))}
                  </div>
                </div>
              )}

              {/* Paused Recurring */}
              {pausedRecurring.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                    {t('pausedRecurring')} ({pausedRecurring.length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pausedRecurring.map((recurring) => (
                      <RecurringCard key={recurring.id} recurring={recurring} onEdit={handleEdit} />
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
