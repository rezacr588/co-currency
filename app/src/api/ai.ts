import type { AIParseRequest, AIParseResponse, AIApplyRequest, AIApplyResponse } from '../types/wallet';
import { fetchAPI } from './base';

export const ai = {
  getStatus: () => fetchAPI<{ configured: boolean; provider?: string }>('/ai/status'),
  parseReceipt: (data: AIParseRequest) =>
    fetchAPI<AIParseResponse>('/ai/parse-text', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  applyParsed: (data: AIApplyRequest) =>
    fetchAPI<AIApplyResponse>('/ai/apply-parsed', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
