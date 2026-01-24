import type {
  Subscription,
  CreateSubscriptionRequest,
  UpdateSubscriptionRequest,
  SubscriptionSummary,
} from '../types/goal';
import { fetchAPI } from './base';
import { buildQuery } from './utils';

export const subscriptions = {
  list: () => fetchAPI<{ subscriptions: Subscription[] }>('/subscriptions'),
  get: (id: string) => fetchAPI<Subscription>(`/subscriptions/${id}`),
  create: (data: CreateSubscriptionRequest) =>
    fetchAPI<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateSubscriptionRequest) =>
    fetchAPI<Subscription>(`/subscriptions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/subscriptions/${id}`, {
      method: 'DELETE',
    }),
  getSummary: (currency?: string) =>
    fetchAPI<SubscriptionSummary>(`/subscriptions/summary${buildQuery({ currency })}`),
  getUpcoming: (days?: number) =>
    fetchAPI<{ upcoming: Subscription[]; within_days: number }>(
      `/subscriptions/upcoming${buildQuery({ days: days || undefined })}`
    ),
  getBillingCycles: () => fetchAPI<{ billing_cycles: string[] }>('/subscriptions/billing-cycles'),
  getCategories: () => fetchAPI<{ categories: string[] }>('/subscriptions/categories'),
};
