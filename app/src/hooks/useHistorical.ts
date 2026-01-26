import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useHistorical(date: string, base: string) {
  return useQuery({
    queryKey: ['historical', date, base],
    queryFn: () => api.rates.historical(date, base),
    enabled: !!date && !!base,
    staleTime: 60 * 60 * 1000, // 1 hour (historical data doesn't change)
  });
}
