import type {
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest,
  ContributeToGoalRequest,
} from '../types/goal';
import type { Transaction } from '../types/wallet';
import { fetchAPI } from './base';
import { createCRUDApi } from './crud';

type GoalResponse = { goal: Goal; progress: number; is_completed: boolean };

const crud = createCRUDApi<
  { goals: Goal[] },
  GoalResponse,
  CreateGoalRequest,
  GoalResponse,
  UpdateGoalRequest
>('/goals');

export const goals = {
  ...crud,

  delete: (id: string) =>
    fetchAPI<{ message: string }>(`/goals/${id}`, {
      method: 'DELETE',
    }),

  contribute: (id: string, data: ContributeToGoalRequest) =>
    fetchAPI<GoalResponse & { transaction: Transaction }>(
      `/goals/${id}/contribute`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  getCategories: () => fetchAPI<{ categories: string[] }>('/goals/categories'),
};
