/**
 * React Query hooks for Financial DNA
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { dna, FinancialDNA, InsightsResponse, QuizQuestion, BehavioralInsight } from '@/src/api/dna';

// Query keys factory
export const dnaKeys = {
  all: ['dna'] as const,
  profile: () => [...dnaKeys.all, 'profile'] as const,
  insights: (limit?: number) => [...dnaKeys.all, 'insights', { limit }] as const,
  quiz: () => [...dnaKeys.all, 'quiz'] as const,
};

/**
 * Get user's financial DNA profile
 */
export function useFinancialDNA(
  options?: Omit<UseQueryOptions<FinancialDNA, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: dnaKeys.profile(),
    queryFn: dna.getDNA,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Refresh/recalculate financial DNA
 */
export function useRefreshDNA(
  options?: UseMutationOptions<FinancialDNA, Error, void>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dna.refreshDNA,
    onSuccess: (data) => {
      queryClient.setQueryData(dnaKeys.profile(), data);
    },
    ...options,
  });
}

/**
 * Get behavioral insights
 */
export function useInsights(
  limit?: number,
  options?: Omit<UseQueryOptions<InsightsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: dnaKeys.insights(limit),
    queryFn: () => dna.getInsights(limit),
    staleTime: 60 * 1000, // 1 minute
    ...options,
  });
}

/**
 * Generate new insights
 */
export function useGenerateInsights(
  options?: UseMutationOptions<{ status: string; message: string }, Error, void>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dna.generateInsights,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dnaKeys.insights() });
    },
    ...options,
  });
}

/**
 * Mark insight as read
 */
export function useMarkInsightRead(
  options?: UseMutationOptions<{ status: string }, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (insightId: string) => dna.markInsightRead(insightId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dnaKeys.insights() });
    },
    ...options,
  });
}

/**
 * Get quiz questions
 */
export function useQuizQuestions(
  options?: Omit<UseQueryOptions<QuizQuestion[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: dnaKeys.quiz(),
    queryFn: dna.getQuizQuestions,
    staleTime: Infinity, // Quiz questions don't change
    ...options,
  });
}
