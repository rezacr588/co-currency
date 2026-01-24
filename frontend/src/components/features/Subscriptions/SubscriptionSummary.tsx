import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api';
import { useLanguage } from '../../../context/LanguageContext';
import { Card } from '../../ui/Card';
import { formatCurrency } from '../../../utils/format';

export function SubscriptionSummary() {
    const { t } = useLanguage();

    const { data: summary, isLoading } = useQuery({
        queryKey: ['subscription-summary'],
        queryFn: () => api.subscriptions.getSummary(),
    });

    const { data: upcoming } = useQuery({
        queryKey: ['subscription-upcoming'],
        queryFn: () => api.subscriptions.getUpcoming(7),
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="p-4 animate-pulse">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
                        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    </Card>
                ))}
            </div>
        );
    }

    const stats = [
        {
            label: t('monthlyTotal') || 'Monthly Total',
            value: formatCurrency(summary?.total_monthly || 0, summary?.currency || 'USD'),
            icon: '📅',
            color: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        },
        {
            label: t('yearlyTotal') || 'Yearly Total',
            value: formatCurrency(summary?.total_yearly || 0, summary?.currency || 'USD'),
            icon: '📊',
            color: 'text-purple-600 dark:text-purple-400',
            bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        },
        {
            label: t('activeSubscriptions') || 'Active',
            value: summary?.active_count || 0,
            icon: '✅',
            color: 'text-green-600 dark:text-green-400',
            bgColor: 'bg-green-50 dark:bg-green-900/20',
        },
        {
            label: t('upcomingRenewals') || 'Due This Week',
            value: upcoming?.upcoming?.length || 0,
            icon: '⏰',
            color: upcoming?.upcoming?.length ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400',
            bgColor: upcoming?.upcoming?.length ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800',
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
                <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                                {stat.label}
                            </p>
                            <p className={`text-2xl font-bold ${stat.color}`}>
                                {stat.value}
                            </p>
                        </div>
                        <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center text-xl`}>
                            {stat.icon}
                        </div>
                    </div>
                </Card>
            ))}

            {/* Category breakdown */}
            {summary?.by_category && Object.keys(summary.by_category).length > 0 && (
                <Card className="p-4 col-span-full lg:col-span-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
                        {t('spendingByCategory') || 'Spending by Category'}
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(summary.by_category)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([category, amount]) => (
                                <div key={category} className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                                        {t(category as any) || category.replace('_', ' ')}
                                    </span>
                                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        {formatCurrency(amount, summary.currency)}/mo
                                    </span>
                                </div>
                            ))}
                    </div>
                </Card>
            )}
        </div>
    );
}
