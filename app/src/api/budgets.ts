import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../types/goal';
import { fetchAPI } from './base';

export const budgets = {
  list: () => fetchAPI<{ budgets: Budget[] }>('/budgets'),
  // Backend returns Budget directly, not wrapped in { budget: ... }
  create: (data: CreateBudgetRequest) =>
    fetchAPI<Budget>('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateBudgetRequest) =>
    fetchAPI<Budget>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/budgets/${id}`, {
      method: 'DELETE',
    }),
};
