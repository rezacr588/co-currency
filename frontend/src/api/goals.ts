import type {
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest,
  ContributeToGoalRequest,
} from '../types/goal';
import type { Transaction } from '../types/wallet';
import { fetchAPI } from './base';

export const goals = {
  list: () => fetchAPI<{ goals: Goal[] }>('/goals'),
  get: (id: string) =>
    fetchAPI<{ goal: Goal; progress: number; is_completed: boolean }>(`/goals/${id}`),
  create: (data: CreateGoalRequest) =>
    fetchAPI<{ goal: Goal; progress: number; is_completed: boolean }>('/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateGoalRequest) =>
    fetchAPI<{ goal: Goal; progress: number; is_completed: boolean }>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/goals/${id}`, {
      method: 'DELETE',
    }),
  contribute: (id: string, data: ContributeToGoalRequest) =>
    fetchAPI<{ goal: Goal; progress: number; is_completed: boolean; transaction: Transaction }>(
      `/goals/${id}/contribute`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  getCategories: () => fetchAPI<{ categories: string[] }>('/goals/categories'),
};
