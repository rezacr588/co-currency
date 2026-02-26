import { API_BASE, getAuthToken, loadTokens, fetchAPI } from './base';
import type {
  GoalFundingRequired,
  MovePlannerItemRequest,
  PlannerBoardResponse,
  PlannerItemType,
  TodoItem,
} from '../types/planner';
import type { Goal } from '../types/goal';

export class GoalFundingRequiredError extends Error {
  details: GoalFundingRequired;

  constructor(details: GoalFundingRequired) {
    super(details.message || 'Goal funding required before marking done');
    this.name = 'GoalFundingRequiredError';
    this.details = details;
  }
}

async function plannerRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
  await loadTokens();
  const token = getAuthToken();

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null as any);
  if (!response.ok) {
    if (response.status === 409 && payload?.error_code === 'goal_funding_required') {
      throw new GoalFundingRequiredError(payload as GoalFundingRequired);
    }

    const message =
      (payload && typeof payload.message === 'string' && payload.message) ||
      (payload && typeof payload.error === 'string' && payload.error) ||
      (payload && typeof payload.details === 'string' && payload.details) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export const planner = {
  getBoard: () => fetchAPI<PlannerBoardResponse>('/planner/board'),

  moveItem: (type: PlannerItemType, id: string, request: MovePlannerItemRequest) =>
    plannerRequest<{ item: TodoItem }>(`/planner/items/${type}/${id}/move`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    }),

  markGoalDone: (goalID: string) =>
    plannerRequest<{ goal: Goal }>(`/planner/goals/${goalID}/mark-done`, {
      method: 'POST',
    }),
};
