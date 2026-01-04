import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { useDebounce } from './useDebounce';

export function useConvert(from: string, to: string, amount: number) {
  const debouncedAmount = useDebounce(amount, 300);

  return useQuery({
    queryKey: ['convert', from, to, debouncedAmount],
    queryFn: () => api.convert({ from, to, amount: debouncedAmount }),
    enabled: debouncedAmount > 0 && from !== to,
    staleTime: 30 * 1000, // 30 seconds
  });
}
