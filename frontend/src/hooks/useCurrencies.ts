import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
