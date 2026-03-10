export interface WealthOverview {
  nominal_total: number;
  real_total: number;
  erosion_amount: number;
  erosion_rate: number;
  shield_score: number;
  shield_label: string;
  shield_trend: 'improving' | 'stable' | 'declining';
  currency: string;
  headline: string;
  currency_breakdown: CurrencyExposure[];
  inflation_data_available: boolean;
}

export interface CurrencyExposure {
  currency: string;
  nominal_balance: number;
  real_balance: number;
  annual_inflation: number;
  share_percentage: number;
  erosion_amount: number;
}

export interface WealthHistoryPoint {
  date: string;
  nominal_value: number;
  real_value: number;
  inflation_rate: number;
}

export interface WealthHistory {
  data_points: WealthHistoryPoint[];
  currency: string;
  total_erosion: number;
}

export interface WhatIfResult {
  actual_value: number;
  hypothetical_value: number;
  difference: number;
  difference_percentage: number;
  explanation: string;
  from_currency: string;
  to_currency: string;
  amount: number;
  months_ago: number;
}

export interface WealthAlert {
  id: string;
  alert_type: 'inflation_spike' | 'currency_drop' | 'weekly_summary' | 'rebalance_suggestion';
  currency_code: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
