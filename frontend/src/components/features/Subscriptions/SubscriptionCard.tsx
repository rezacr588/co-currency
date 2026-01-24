import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { formatCurrency } from '../../../utils/format';
import type { Subscription, UpdateSubscriptionRequest } from '../../../types/goal';

const CATEGORY_ICONS: Record<string, string> = {
    streaming: '🎬',
    software: '💻',
    gaming: '🎮',
    fitness: '💪',
    utilities: '🔌',
    news_media: '📰',
    cloud_storage: '☁️',
    education: '📚',
    food_delivery: '🍔',
    shopping: '🛒',
    finance: '💳',
    productivity: '📊',
    other: '📦',
};

const BILLING_CYCLE_LABELS: Record<string, string> = {
    weekly: '/week',
    monthly: '/month',
    quarterly: '/quarter',
    yearly: '/year',
};

interface SubscriptionCardProps {
    subscription: Subscription;
    onEdit: (subscription: Subscription) => void;
    onDelete: (id: string) => void;
}

export function SubscriptionCard({ subscription, onEdit, onDelete }: SubscriptionCardProps) {
    const { t } = useLanguage();
    const toast = useToast();
    const queryClient = useQueryClient();

    const updateMutation = useMutation({
        mutationFn: (data: UpdateSubscriptionRequest) => api.subscriptions.update(subscription.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['subscription-summary'] });
            toast.success('Subscription updated');
        },
    });

    const toggleStatus = () => {
        const newStatus = subscription.status === 'active' ? 'paused' : 'active';
        updateMutation.mutate({ status: newStatus as 'active' | 'paused' | 'cancelled' });
    };

    const daysUntilBilling = () => {
        const today = new Date();
        const billingDate = new Date(subscription.next_billing_date);
        const diffTime = billingDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const days = daysUntilBilling();
    const categoryIcon = CATEGORY_ICONS[subscription.category || 'other'] || '📦';
    const isUpcoming = days >= 0 && days <= subscription.reminder_days;

    return (
        <div className={`
      relative p-4 rounded-xl border transition-all
      ${subscription.status === 'active'
                ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-md'
                : subscription.status === 'paused'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60'}
    `}>
            {/* Status badge */}
            {subscription.status !== 'active' && (
                <div className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full ${subscription.status === 'paused'
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}>
                    {t(subscription.status) || subscription.status}
                </div>
            )}

            {/* Upcoming reminder badge */}
            {isUpcoming && subscription.status === 'active' && (
                <div className="absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400">
                    {days === 0 ? t('dueToday') || 'Due today' : `${days} ${t('daysLeft') || 'days left'}`}
                </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl">
                    {subscription.logo_url ? (
                        <img src={subscription.logo_url} alt={subscription.name} className="w-8 h-8 rounded" />
                    ) : (
                        categoryIcon
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {subscription.name}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        {t((subscription.category || 'other') as any) || subscription.category || 'Other'}
                    </p>
                </div>
            </div>

            {/* Amount */}
            <div className="mb-3">
                <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(subscription.amount, subscription.currency)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {BILLING_CYCLE_LABELS[subscription.billing_cycle]}
                </span>
            </div>

            {/* Next billing date */}
            <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t('nextBilling') || 'Next billing'}: {new Date(subscription.next_billing_date).toLocaleDateString()}
            </div>

            {/* Notes */}
            {subscription.notes && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 line-clamp-2">
                    {subscription.notes}
                </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button
                    onClick={() => onEdit(subscription)}
                    className="flex-1 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                    {t('edit') || 'Edit'}
                </button>
                {subscription.status !== 'cancelled' && (
                    <button
                        onClick={toggleStatus}
                        className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${subscription.status === 'active'
                            ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                    >
                        {subscription.status === 'active' ? t('pause') || 'Pause' : t('resume') || 'Resume'}
                    </button>
                )}
                <button
                    onClick={() => onDelete(subscription.id)}
                    className="px-3 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                >
                    {t('delete') || 'Delete'}
                </button>
            </div>
        </div>
    );
}
