import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: () => api.currencies.list(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
}
