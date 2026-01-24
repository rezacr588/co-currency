import type { Budget, CreateBudgetRequest, UpdateBudgetRequest } from '../types/goal';
import { fetchAPI } from './base';

export const budgets = {
  list: () => fetchAPI<{ budgets: Budget[] }>('/budgets'),
  create: (data: CreateBudgetRequest) =>
    fetchAPI<{ budget: Budget }>('/budgets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateBudgetRequest) =>
    fetchAPI<{ budget: Budget }>(`/budgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/budgets/${id}`, {
      method: 'DELETE',
    }),
};
