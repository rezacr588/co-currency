import type { RecurringTransaction, CreateRecurringRequest, UpdateRecurringRequest } from '../types/goal';
import type { Transaction } from '../types/wallet';
import { fetchAPI } from './base';

export const recurring = {
  list: () => fetchAPI<{ recurring_transactions: RecurringTransaction[] }>('/recurring'),
  create: (data: CreateRecurringRequest) =>
    fetchAPI<RecurringTransaction>('/recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateRecurringRequest) =>
    fetchAPI<RecurringTransaction>(`/recurring/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/recurring/${id}`, {
      method: 'DELETE',
    }),
  execute: (id: string) =>
    fetchAPI<{ transaction: Transaction; recurring_transaction: RecurringTransaction }>(
      `/recurring/${id}/execute`,
      {
        method: 'POST',
      }
    ),
};
