/**
 * Agent Hooks - React Query hooks for autonomous financial agent
 * 
 * Provides:
 * - Plan management (list, create, update, delete)
 * - Step approvals and rejections
 * - Agent configuration
 * - Daily briefings and autopilot
 */

import { 
  useQuery, 
  useMutation, 
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from '@tanstack/react-query';
import { api } from '../api';
import { STALE_REALTIME, STALE_FREQUENT, STALE_STANDARD, STALE_SLOW } from '../config/queryConfig';
import type {
  AgentPlan,
  PlanStep,
  AgentConfig,
  DailyBriefing,
  ActionApproval,
  ActionLog,
  AutopilotResult,
  AutopilotStatus,
  PlanStatus,
  CreatePlanRequest,
  UpdatePlanRequest,
  UpdateConfigRequest,
  ApproveStepRequest,
  RejectStepRequest,
  PlansResponse,
  PlanResponse,
  ApprovalsResponse,
  LogsResponse,
  ConfigResponse,
  BriefingResponse,
  AutopilotResponse,
} from '../api/agent';

// Query keys for cache management
export const agentKeys = {
  all: ['agent'] as const,
  plans: () => [...agentKeys.all, 'plans'] as const,
  plansList: (filters?: { status?: PlanStatus }) => 
    [...agentKeys.plans(), 'list', filters] as const,
  plan: (id: string) => [...agentKeys.plans(), 'detail', id] as const,
  approvals: () => [...agentKeys.all, 'approvals'] as const,
  pendingApprovals: () => [...agentKeys.approvals(), 'pending'] as const,
  config: () => [...agentKeys.all, 'config'] as const,
  logs: (filters?: { limit?: number; offset?: number }) => 
    [...agentKeys.all, 'logs', filters] as const,
  briefing: () => [...agentKeys.all, 'briefing'] as const,
  autopilot: () => [...agentKeys.all, 'autopilot'] as const,
  autopilotStatus: () => [...agentKeys.all, 'autopilot', 'status'] as const,
};

// ============================================================================
// Plans Hooks
// ============================================================================

interface UsePlansOptions {
  status?: PlanStatus;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

/**
 * Hook for listing user's financial plans
 */
export function useAgentPlans(
  options: UsePlansOptions = {},
  queryOptions?: Omit<UseQueryOptions<PlansResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { status, limit = 20, offset = 0, enabled = true } = options;

  return useQuery({
    queryKey: agentKeys.plansList({ status }),
    queryFn: () => api.agent.listPlans({ status, limit, offset }),
    staleTime: STALE_REALTIME,
    enabled,
    ...queryOptions,
  });
}

/**
 * Hook for getting a single plan by ID
 */
export function useAgentPlan(
  planId: string,
  queryOptions?: Omit<UseQueryOptions<PlanResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.plan(planId),
    queryFn: () => api.agent.getPlan(planId),
    staleTime: STALE_FREQUENT,
    enabled: !!planId,
    ...queryOptions,
  });
}

/**
 * Hook for creating a new financial plan
 */
export function useCreatePlan(
  options?: UseMutationOptions<PlanResponse, Error, CreatePlanRequest>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePlanRequest) => api.agent.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.plans() });
    },
    ...options,
  });
}

/**
 * Hook for updating a plan
 */
export function useUpdatePlan(
  options?: UseMutationOptions<PlanResponse, Error, { planId: string; data: UpdatePlanRequest }>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, data }) => api.agent.updatePlan(planId, data),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.plan(planId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.plans() });
    },
    ...options,
  });
}

/**
 * Hook for deleting (cancelling) a plan
 */
export function useDeletePlan(
  options?: UseMutationOptions<{ message: string }, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => api.agent.deletePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.plans() });
    },
    ...options,
  });
}

/**
 * Hook for activating a plan
 */
export function useActivatePlan(
  options?: UseMutationOptions<PlanResponse, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => api.agent.activatePlan(planId),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.plan(planId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.plans() });
    },
    ...options,
  });
}

/**
 * Hook for pausing a plan
 */
export function usePausePlan(
  options?: UseMutationOptions<PlanResponse, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => api.agent.pausePlan(planId),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.plan(planId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.plans() });
    },
    ...options,
  });
}

/**
 * Hook for resuming a paused plan
 */
export function useResumePlan(
  options?: UseMutationOptions<PlanResponse, Error, string>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (planId: string) => api.agent.resumePlan(planId),
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.plan(planId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.plans() });
    },
    ...options,
  });
}

// ============================================================================
// Approvals Hooks
// ============================================================================

/**
 * Hook for getting pending approvals
 */
export function usePendingApprovals(
  queryOptions?: Omit<UseQueryOptions<ApprovalsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.pendingApprovals(),
    queryFn: () => api.agent.getPendingApprovals(),
    staleTime: STALE_REALTIME,
    refetchInterval: STALE_FREQUENT,
    ...queryOptions,
  });
}

/**
 * Hook for approving a step
 */
export function useApproveStep(
  options?: UseMutationOptions<
    { message: string; step: PlanStep }, 
    Error, 
    { planId: string; stepId: string; data: ApproveStepRequest }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, stepId, data }) => 
      api.agent.approveStep(planId, stepId, data),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.pendingApprovals() });
      queryClient.invalidateQueries({ queryKey: agentKeys.plan(planId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.briefing() });
    },
    ...options,
  });
}

/**
 * Hook for rejecting a step
 */
export function useRejectStep(
  options?: UseMutationOptions<
    { message: string; step: PlanStep }, 
    Error, 
    { planId: string; stepId: string; data: RejectStepRequest }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, stepId, data }) => 
      api.agent.rejectStep(planId, stepId, data),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: agentKeys.pendingApprovals() });
      queryClient.invalidateQueries({ queryKey: agentKeys.plan(planId) });
      queryClient.invalidateQueries({ queryKey: agentKeys.briefing() });
    },
    ...options,
  });
}

// ============================================================================
// Configuration Hooks
// ============================================================================

/**
 * Hook for getting agent configuration
 */
export function useAgentConfig(
  queryOptions?: Omit<UseQueryOptions<ConfigResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.config(),
    queryFn: () => api.agent.getConfig(),
    staleTime: STALE_STANDARD,
    ...queryOptions,
  });
}

/**
 * Hook for updating agent configuration
 */
export function useUpdateAgentConfig(
  options?: UseMutationOptions<ConfigResponse, Error, UpdateConfigRequest>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateConfigRequest) => api.agent.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.config() });
    },
    ...options,
  });
}

// ============================================================================
// Logs Hooks
// ============================================================================

interface UseLogsOptions {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

/**
 * Hook for getting action logs
 */
export function useAgentLogs(
  options: UseLogsOptions = {},
  queryOptions?: Omit<UseQueryOptions<LogsResponse, Error>, 'queryKey' | 'queryFn'>
) {
  const { limit = 50, offset = 0, enabled = true } = options;

  return useQuery({
    queryKey: agentKeys.logs({ limit, offset }),
    queryFn: () => api.agent.getLogs({ limit, offset }),
    staleTime: STALE_FREQUENT,
    enabled,
    ...queryOptions,
  });
}

// ============================================================================
// Briefing & Autopilot Hooks
// ============================================================================

/**
 * Hook for getting daily financial briefing
 */
export function useDailyBriefing(
  queryOptions?: Omit<UseQueryOptions<BriefingResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.briefing(),
    queryFn: () => api.agent.getDailyBriefing(),
    staleTime: STALE_STANDARD,
    ...queryOptions,
  });
}

/**
 * Hook for triggering manual autopilot scan
 */
export function useTriggerAutopilot(
  options?: UseMutationOptions<AutopilotResponse, Error, void>
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.agent.triggerAutopilot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.briefing() });
      queryClient.invalidateQueries({ queryKey: agentKeys.autopilot() });
      queryClient.invalidateQueries({ queryKey: agentKeys.autopilotStatus() });
    },
    ...options,
  });
}

/**
 * Hook for the consolidated autopilot status — drives AutopilotCard header.
 */
export function useAutopilotStatus(
  queryOptions?: Omit<UseQueryOptions<AutopilotStatus, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.autopilotStatus(),
    queryFn: () => api.agent.getAutopilotStatus(),
    staleTime: STALE_FREQUENT,
    ...queryOptions,
  });
}

/**
 * Hook for getting latest autopilot result
 */
export function useAutopilotResult(
  queryOptions?: Omit<UseQueryOptions<AutopilotResponse, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: agentKeys.autopilot(),
    queryFn: () => api.agent.getAutopilotResult(),
    staleTime: STALE_FREQUENT,
    ...queryOptions,
  });
}

// ============================================================================
// Combined Hooks for Dashboard Views
// ============================================================================

/**
 * Combined hook for agent dashboard data
 * Returns all necessary data for the main agent dashboard view
 */
export function useAgentDashboard(options: { enabled?: boolean } = {}) {
  const { enabled = true } = options;

  const plans = useAgentPlans({ status: 'active', enabled });
  const pendingApprovals = usePendingApprovals({ enabled });
  const briefing = useDailyBriefing({ enabled });
  const config = useAgentConfig({ enabled });

  return {
    plans,
    pendingApprovals,
    briefing,
    config,
    isLoading: plans.isLoading || pendingApprovals.isLoading || briefing.isLoading,
    isError: plans.isError || pendingApprovals.isError || briefing.isError,
    error: plans.error || pendingApprovals.error || briefing.error,
    refetchAll: async () => {
      await Promise.all([
        plans.refetch(),
        pendingApprovals.refetch(),
        briefing.refetch(),
      ]);
    },
  };
}

/**
 * Hook to check if agent is enabled and has pending items
 * Useful for showing notification badges
 */
export function useAgentStatus() {
  const config = useAgentConfig();
  const pendingApprovals = usePendingApprovals({ 
    enabled: config.data?.config?.enabled ?? false 
  });

  return {
    isEnabled: config.data?.config?.enabled ?? false,
    isLoading: config.isLoading,
    pendingCount: pendingApprovals.data?.approvals?.length ?? 0,
    hasPendingActions: (pendingApprovals.data?.approvals?.length ?? 0) > 0,
  };
}

export default {
  // Plans
  useAgentPlans,
  useAgentPlan,
  useCreatePlan,
  useUpdatePlan,
  useDeletePlan,
  useActivatePlan,
  usePausePlan,
  useResumePlan,
  // Approvals
  usePendingApprovals,
  useApproveStep,
  useRejectStep,
  // Config
  useAgentConfig,
  useUpdateAgentConfig,
  // Logs
  useAgentLogs,
  // Briefing & Autopilot
  useDailyBriefing,
  useTriggerAutopilot,
  useAutopilotResult,
  useAutopilotStatus,
  // Combined
  useAgentDashboard,
  useAgentStatus,
};
