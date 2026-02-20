import type {
  AIParseRequest,
  AIParseResponse,
  AIApplyRequest,
  AIApplyResponse,
  SmartParseResponse,
  IntentResponse,
  ApplyRecurringRequest,
  ApplyGoalContributionRequest,
  Transaction,
} from '../types/wallet';
import type { RecurringTransaction, Goal } from '../types/goal';
import { fetchAPI } from './base';

export interface PersonalizedAdvice {
  title: string;
  detail: string;
  category: string;
  is_ai: boolean;
}

export const ai = {
  getStatus: () => fetchAPI<{ configured: boolean; provider?: string }>('/ai/status'),

  getAdvice: (lang?: string, forceRefresh?: boolean) => {
    const params = new URLSearchParams();
    if (lang) params.append('lang', lang);
    if (forceRefresh) params.append('refresh', 'true');
    const queryString = params.toString();
    return fetchAPI<PersonalizedAdvice>(`/ai/advice${queryString ? `?${queryString}` : ''}`);
  },

  parseReceipt: (data: AIParseRequest) =>
    fetchAPI<AIParseResponse>('/ai/parse-text', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Lightweight intent detection — AI model classifies user intent
  detectIntent: (data: AIParseRequest) =>
    fetchAPI<IntentResponse>('/ai/detect-intent', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Full smart parse with transaction details extraction
  smartParse: (data: AIParseRequest) =>
    fetchAPI<SmartParseResponse>('/ai/smart-parse', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  applyParsed: (data: AIApplyRequest) =>
    fetchAPI<AIApplyResponse>('/ai/apply-parsed', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Create recurring transaction from AI parse
  applyRecurring: (data: ApplyRecurringRequest) =>
    fetchAPI<RecurringTransaction>('/ai/apply-recurring', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Contribute to goal from AI parse
  applyGoalContribution: (data: ApplyGoalContributionRequest) =>
    fetchAPI<{ goal: Goal; transaction: Transaction }>('/ai/apply-goal-contribution', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
