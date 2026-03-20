import { fetchAPI } from './base';
import { buildQuery } from './utils';

// Types for forecasting API responses
export interface ForecastPrediction {
  date: string;
  income: number;
  expenses: number;
  net_cash_flow: number;
  balance: number;
  confidence: {
    income: number;
    expenses: number;
  };
}

export interface ForecastMetadata {
  total_historical_days: number;
  avg_daily_income: number;
  avg_daily_expenses: number;
  income_volatility: number;
  expense_volatility: number;
  model_type: string;
}

export interface ForecastResponse {
  predictions: ForecastPrediction[];
  confidence_score: number;
  currency: string;
  metadata: ForecastMetadata;
}

export interface Anomaly {
  date: string;
  category: string;
  amount: number;
  expected_range: [number, number];
  z_score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
}

export interface AnomalySummary {
  total_transactions: number;
  anomaly_count: number;
  categories_affected: string[];
  threshold_used: number;
}

export interface AnomalyDetectionResponse {
  anomalies: Anomaly[];
  summary: AnomalySummary;
}

export interface ForecastingHealthResponse {
  status: string;
  service: string;
}

export const forecasting = {
  /**
   * Check if ML forecasting service is available
   */
  health: () => fetchAPI<ForecastingHealthResponse>('/forecasting/health'),

  /**
   * Get cash flow predictions for the next N days
   * @param days Number of days to forecast (1-90, default: 30)
   * @param currency Currency for forecast (default: USD)
   */
  predict: (days?: number, currency?: string) =>
    fetchAPI<ForecastResponse>(
      `/forecasting/predict${buildQuery({
        days: days || undefined,
        currency: currency || undefined,
      })}`
    ),

  /**
   * Detect spending anomalies in transaction history
   * @param threshold Z-score threshold for anomaly detection (default: 2.5)
   */
  detectAnomalies: (threshold?: number) =>
    fetchAPI<AnomalyDetectionResponse>(
      `/forecasting/anomalies${buildQuery({
        threshold: threshold || undefined,
      })}`
    ),
};

export default forecasting;
