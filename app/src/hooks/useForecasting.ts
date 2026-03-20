import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { api } from '../api';
import type {
  ForecastResponse,
  AnomalyDetectionResponse,
  ForecastingHealthResponse,
} from '../api/forecasting';

/**
 * Hook for checking ML forecasting service health
 */
export function useForecastingHealth(
  options?: Omit<UseQueryOptions<ForecastingHealthResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: ['forecasting', 'health'],
    queryFn: () => api.forecasting.health(),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    ...options,
  });
}

interface UseForecastOptions {
  days?: number;
  currency?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching cash flow predictions
 * @param options.days Number of days to forecast (1-90, default: 30)
 * @param options.currency Currency for forecast (default: USD)
 * @param options.enabled Whether to enable the query
 */
export function useForecast(
  options: UseForecastOptions = {},
  queryOptions?: Omit<UseQueryOptions<ForecastResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { days = 30, currency = 'USD', enabled = true } = options;

  return useQuery({
    queryKey: ['forecasting', 'predict', { days, currency }],
    queryFn: () => api.forecasting.predict(days, currency),
    staleTime: 30 * 60 * 1000, // 30 minutes (forecasts don't change frequently)
    refetchOnWindowFocus: false,
    enabled,
    retry: 2,
    ...queryOptions,
  });
}

interface UseAnomaliesOptions {
  threshold?: number;
  enabled?: boolean;
}

/**
 * Hook for detecting spending anomalies
 * @param options.threshold Z-score threshold for anomaly detection (default: 2.5)
 * @param options.enabled Whether to enable the query
 */
export function useAnomalies(
  options: UseAnomaliesOptions = {},
  queryOptions?: Omit<UseQueryOptions<AnomalyDetectionResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { threshold = 2.5, enabled = true } = options;

  return useQuery({
    queryKey: ['forecasting', 'anomalies', { threshold }],
    queryFn: () => api.forecasting.detectAnomalies(threshold),
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: true,
    enabled,
    retry: 2,
    ...queryOptions,
  });
}

/**
 * Combined hook for forecast and anomalies data
 * Useful for dashboard views that need both
 */
export function useForecastingData(options: {
  days?: number;
  currency?: string;
  threshold?: number;
  enabled?: boolean;
}) {
  const { days = 30, currency = 'USD', threshold = 2.5, enabled = true } = options;

  const forecast = useForecast({ days, currency, enabled });
  const anomalies = useAnomalies({ threshold, enabled });
  const health = useForecastingHealth({ enabled });

  return {
    forecast,
    anomalies,
    health,
    isLoading: forecast.isLoading || anomalies.isLoading,
    isError: forecast.isError || anomalies.isError,
    error: forecast.error || anomalies.error,
    refetchAll: async () => {
      await Promise.all([forecast.refetch(), anomalies.refetch()]);
    },
  };
}

export default {
  useForecastingHealth,
  useForecast,
  useAnomalies,
  useForecastingData,
};
