import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { Card, CardHeader, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { ErrorMessage } from '../../ui/ErrorMessage';
import { SubscriptionForm } from './SubscriptionForm';
import { SubscriptionCard } from './SubscriptionCard';
import { SubscriptionSummary } from './SubscriptionSummary';
import type { Subscription } from '../../../types/goal';

export function SubscriptionList() {
    const { t } = useLanguage();
    const toast = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [filter, setFilter] = useState<'all' | 'active' | 'paused' | 'cancelled'>('all');

    const { data, isLoading, error } = useQuery({
        queryKey: ['subscriptions'],
        queryFn: () => api.subscriptions.list(),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.subscriptions.delete(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['subscription-summary'] });
            toast.success('Subscription deleted');
        },
        onError: () => {
            toast.error('Error deleting subscription');
        },
    });

    const handleEdit = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setShowForm(true);
    };

    const handleCloseForm = () => {
        setShowForm(false);
        setEditingSubscription(null);
    };

    const filteredSubscriptions = data?.subscriptions?.filter(sub => {
        if (filter === 'all') return true;
        return sub.status === filter;
    }) || [];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
            </div>
        );
    }

    if (error) {
        return <ErrorMessage>Error loading subscriptions</ErrorMessage>;
    }

    return (
        <div className="space-y-6">
            {/* Summary */}
            <SubscriptionSummary />

            {/* Header */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            {t('subscriptions') || 'Subscriptions'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('manageRecurringPayments') || 'Manage your recurring payments and services'}
                        </p>
                    </div>
                    <Button
                        variant="primary"
                        onClick={() => setShowForm(true)}
                    >
                        <svg className="w-4 h-4 me-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        {t('addSubscription') || 'Add Subscription'}
                    </Button>
                </CardHeader>

                {/* Filter tabs */}
                <div className="px-6 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex gap-2">
                        {(['all', 'active', 'paused', 'cancelled'] as const).map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilter(status)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${filter === status
                                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {status === 'all' ? t('all') || 'All' : t(status) || status.charAt(0).toUpperCase() + status.slice(1)}
                                {status !== 'all' && (
                                    <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-200 dark:bg-slate-700">
                                        {data?.subscriptions?.filter(s => s.status === status).length || 0}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <CardContent>
                    {filteredSubscriptions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('noSubscriptions') || 'No subscriptions yet'}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                {t('trackRecurringPayments') || 'Start tracking your recurring payments and subscriptions'}
                            </p>
                            <Button variant="primary" onClick={() => setShowForm(true)}>
                                {t('addFirstSubscription') || 'Add your first subscription'}
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredSubscriptions.map((subscription) => (
                                <SubscriptionCard
                                    key={subscription.id}
                                    subscription={subscription}
                                    onEdit={handleEdit}
                                    onDelete={(id) => deleteMutation.mutate(id)}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Form Modal */}
            {showForm && (
                <SubscriptionForm
                    subscription={editingSubscription}
                    onClose={handleCloseForm}
                />
            )}
        </div>
    );
}
