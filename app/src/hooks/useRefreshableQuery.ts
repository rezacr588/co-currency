import { useState, useCallback } from 'react';
import { useQuery, UseQueryOptions } from '@tanstack/react-query';

/**
 * Wraps useQuery with RefreshControl state management.
 * Eliminates the repeated useState(refreshing) + onRefresh + refetch pattern.
 */
export function useRefreshableQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
>(options: UseQueryOptions<TQueryFnData, TError, TData>) {
  const [refreshing, setRefreshing] = useState(false);
  const query = useQuery(options);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query.refetch]);

  return { ...query, refreshing, onRefresh };
}

/**
 * Provides RefreshControl state for screens with multiple queries.
 * Pass all refetch functions and get back refreshing + onRefresh.
 */
export function useRefreshControl(...refetchFns: Array<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(refetchFns.map((fn) => fn()));
    } finally {
      setRefreshing(false);
    }
  }, refetchFns);

  return { refreshing, onRefresh };
}
