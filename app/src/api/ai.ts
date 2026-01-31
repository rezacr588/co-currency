import type {
  AIParseRequest,
  AIParseResponse,
  AIApplyRequest,
  AIApplyResponse,
  SmartParseResponse,
  ApplyRecurringRequest,
  ApplyGoalContributionRequest,
  Transaction,
} from '../types/wallet';
import type { RecurringTransaction, Goal } from '../types/goal';
import { fetchAPI } from './base';

export const ai = {
  getStatus: () => fetchAPI<{ configured: boolean; provider?: string }>('/ai/status'),

  parseReceipt: (data: AIParseRequest) =>
    fetchAPI<AIParseResponse>('/ai/parse-text', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Enhanced smart parse with action type detection
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
