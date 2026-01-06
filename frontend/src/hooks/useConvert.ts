import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDebounce } from './useDebounce';

export function useConvert(from: string, to: string, amount: number) {
  // Reduced debounce from 300ms to 150ms for more responsive feel
  const debouncedAmount = useDebounce(amount, 150);

  return useQuery({
    queryKey: ['convert', from, to, debouncedAmount],
    queryFn: () => api.convert({ from, to, amount: debouncedAmount }),
    enabled: debouncedAmount > 0 && from !== to,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnMount: false, // Prevent refetching on component mount
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}
