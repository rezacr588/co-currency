import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { useLanguage } from '../../../context/LanguageContext';
import { useToast } from '../../../context/ToastContext';
import { Button } from '../../ui/Button';
import { SUBSCRIPTION_BILLING_CYCLES, SUBSCRIPTION_CATEGORIES } from '../../../types/goal';
import type { Subscription, CreateSubscriptionRequest, UpdateSubscriptionRequest } from '../../../types/goal';

interface SubscriptionFormProps {
    subscription?: Subscription | null;
    onClose: () => void;
}

export function SubscriptionForm({ subscription, onClose }: SubscriptionFormProps) {
    const { t } = useLanguage();
    const toast = useToast();
    const queryClient = useQueryClient();
    const isEditing = !!subscription;

    const [formData, setFormData] = useState({
        name: subscription?.name || '',
        amount: subscription?.amount?.toString() || '',
        currency: subscription?.currency || 'USD',
        billing_cycle: subscription?.billing_cycle || 'monthly',
        category: subscription?.category || '',
        next_billing_date: subscription?.next_billing_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        reminder_days: subscription?.reminder_days?.toString() || '3',
        notes: subscription?.notes || '',
        logo_url: subscription?.logo_url || '',
    });

    const createMutation = useMutation({
        mutationFn: (data: CreateSubscriptionRequest) => api.subscriptions.create(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['subscription-summary'] });
            queryClient.invalidateQueries({ queryKey: ['badges'] });
            toast.success('Subscription created');
            onClose();
        },
        onError: () => {
            toast.error('Error creating subscription');
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: UpdateSubscriptionRequest) => api.subscriptions.update(subscription!.id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
            queryClient.invalidateQueries({ queryKey: ['subscription-summary'] });
            toast.success('Subscription updated');
            onClose();
        },
        onError: () => {
            toast.error('Error updating subscription');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const data = {
            name: formData.name,
            amount: parseFloat(formData.amount),
            currency: formData.currency,
            billing_cycle: formData.billing_cycle as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
            category: formData.category || undefined,
            next_billing_date: formData.next_billing_date,
            reminder_days: parseInt(formData.reminder_days) || 3,
            notes: formData.notes || undefined,
            logo_url: formData.logo_url || undefined,
        };

        if (isEditing) {
            updateMutation.mutate(data);
        } else {
            createMutation.mutate(data);
        }
    };

    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'TRY', 'IRR'];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                            {isEditing ? t('editSubscription') || 'Edit Subscription' : t('addSubscription') || 'Add Subscription'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('name') || 'Name'} *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder={t('subscriptionNamePlaceholder') || 'e.g., Netflix, Spotify, Adobe...'}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>

                    {/* Amount & Currency */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('amount') || 'Amount'} *
                            </label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                min="0"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('currency') || 'Currency'} *
                            </label>
                            <select
                                required
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                {currencies.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Billing Cycle & Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('billingCycle') || 'Billing Cycle'} *
                            </label>
                            <select
                                required
                                value={formData.billing_cycle}
                                onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value as any })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                {SUBSCRIPTION_BILLING_CYCLES.map((cycle) => (
                                    <option key={cycle} value={cycle}>
                                        {t(cycle) || cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('category') || 'Category'}
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            >
                                <option value="">{t('selectCategory') || 'Select category'}</option>
                                {SUBSCRIPTION_CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {t(cat as any) || cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Next Billing Date & Reminder */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('nextBillingDate') || 'Next Billing Date'} *
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.next_billing_date}
                                onChange={(e) => setFormData({ ...formData, next_billing_date: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                {t('reminderDays') || 'Remind me (days before)'}
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="30"
                                value={formData.reminder_days}
                                onChange={(e) => setFormData({ ...formData, reminder_days: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('notes') || 'Notes'}
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder={t('optionalNotes') || 'Optional notes about this subscription...'}
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Logo URL */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            {t('logoUrl') || 'Logo URL'} ({t('optional') || 'optional'})
                        </label>
                        <input
                            type="url"
                            value={formData.logo_url}
                            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                            placeholder="https://..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <Button variant="ghost" onClick={onClose}>
                        {t('cancel') || 'Cancel'}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={createMutation.isPending || updateMutation.isPending}
                    >
                        {(createMutation.isPending || updateMutation.isPending) && (
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        )}
                        {isEditing ? t('save') || 'Save' : t('create') || 'Create'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
