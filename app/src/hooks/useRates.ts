import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useRates(base: string) {
  return useQuery({
    queryKey: ['rates', base],
    queryFn: () => api.rates.latest(base),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every minute
  });
}
