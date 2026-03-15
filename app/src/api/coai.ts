import { fetchAPI } from './base';

export interface RecommendedAction {
  id: string;
  type: string;
  title: string;
  description: string;
  cta_label: string;
  target_route: string;
  prefill?: Record<string, unknown>;
  requires_confirmation: boolean;
}

export interface CoAIPriority {
  id: string;
  title: string;
  description: string;
  target_route?: string;
}

export interface CoAIAlert {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical' | string;
  target_route?: string;
}

export interface CoAIContextSnapshot {
  total_balance: number;
  balance_currency_count: number;
  recent_transaction_count: number;
  active_budget_count: number;
  active_goal_count: number;
  active_subscription_count: number;
}

export interface CoAIBriefResponse {
  generated_at: string;
  currency: string;
  brief: string;
  priorities: CoAIPriority[];
  alerts: CoAIAlert[];
  recommended_actions: RecommendedAction[];
  context_snapshot: CoAIContextSnapshot;
}

export interface CoAIPreferences {
  user_id: string;
  preferred_currency: string;
  focus_areas: string[];
  weekly_brief_enabled: boolean;
  proactive_alerts_enabled: boolean;
  updated_at: string;
}

export const coai = {
  getBrief: () =>
    fetchAPI<CoAIBriefResponse>('/coai/brief'),

  getPreferences: () =>
    fetchAPI<{ preferences: CoAIPreferences }>('/coai/preferences'),

  updatePreferences: (preferences: Partial<CoAIPreferences>) =>
    fetchAPI<{ preferences: CoAIPreferences }>('/coai/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    }),
};
