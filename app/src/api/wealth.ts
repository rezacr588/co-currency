import type { WealthOverview, WealthHistory, WhatIfResult, WealthAlert } from '../types/wealth';
import { fetchAPI } from './base';
import { buildQuery } from './utils';

export const wealth = {
  overview: (currency?: string) =>
    fetchAPI<WealthOverview>(`/wealth/overview${buildQuery({ currency })}`),

  history: (currency?: string, months?: number) =>
    fetchAPI<WealthHistory>(`/wealth/history${buildQuery({ currency, months: months || undefined })}`),

  whatIf: (params: { from: string; to: string; amount: number; months_ago?: number }) =>
    fetchAPI<WhatIfResult>(`/wealth/what-if${buildQuery(params)}`),

  alerts: () =>
    fetchAPI<{ alerts: WealthAlert[] }>('/wealth/alerts'),

  markAlertRead: (id: string) =>
    fetchAPI<{ success: boolean }>(`/wealth/alerts/${id}/read`, { method: 'POST' }),
};
