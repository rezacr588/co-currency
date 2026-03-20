/**
 * Agent API - Autonomous Financial Agent endpoints
 * 
 * This module provides API access to the autonomous agent features:
 * - Financial plans with multi-step execution
 * - Action approvals and rejection
 * - Daily autopilot briefings
 * - Agent configuration
 */

import { fetchAPI } from './base';

// ============================================================================
// Types
// ============================================================================

export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type PlanPriority = 'low' | 'medium' | 'high' | 'urgent';
export type StepStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'skipped';
export type ActionType = 
  | 'transfer' 
  | 'goal_contribution' 
  | 'budget_adjustment' 
  | 'recurring_update' 
  | 'subscription_cancel' 
  | 'debt_payment' 
  | 'alert' 
  | 'recommendation';

export interface AgentPlan {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal_type: string;
  status: PlanStatus;
  priority: PlanPriority;
  target_amount?: number;
  target_currency?: string;
  workflow_status?: string;
  ai_reasoning?: string;
  created_at: string;
  updated_at: string;
  steps?: PlanStep[];
}

export interface PlanStep {
  id: string;
  plan_id: string;
  step_order: number;
  title: string;
  description?: string;
  action_type: ActionType;
  action_params: Record<string, unknown>;
  status: StepStatus;
  requires_approval: boolean;
  estimated_impact?: number;
  actual_impact?: number;
  executed_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionApproval {
  id: string;
  step_id: string;
  user_id: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'expired';
  approval_method?: 'manual' | 'biometric' | 'auto' | 'voice';
  approved_at?: string;
  expires_at: string;
  rejection_reason?: string;
  device_info?: Record<string, unknown>;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export interface ActionLog {
  id: string;
  user_id: string;
  plan_id?: string;
  step_id?: string;
  action_type: ActionType;
  action_details: Record<string, unknown>;
  result_status: 'success' | 'failure' | 'partial';
  result_details?: Record<string, unknown>;
  executed_at: string;
  execution_time_ms: number;
}

export interface AgentConfig {
  user_id: string;
  enabled: boolean;
  auto_approve_threshold: number;
  auto_approve_currency: string;
  require_biometric_above: number;
  daily_autopilot_enabled: boolean;
  autopilot_time: string; // HH:MM:SS
  autopilot_timezone: string;
  allowed_action_types: ActionType[];
  notification_preferences: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface UpcomingBill {
  id: string;
  title: string;
  amount: number;
  currency: string;
  due_date: string;
  days_until: number;
  can_afford: boolean;
}

export interface BalanceHealth {
  status: 'healthy' | 'warning' | 'critical';
  projected_balance: number;
  currency: string;
  days_until_low?: number;
  recommendations?: string[];
}

export interface GoalOpportunity {
  goal_id: string;
  goal_title: string;
  current_progress: number;
  suggested_amount: number;
  currency: string;
  impact_on_timeline: string;
}

export interface RecommendedAction {
  type: ActionType;
  title: string;
  description: string;
  impact: number;
  currency: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
}

export interface DailyBriefing {
  date: string;
  status: string;
  upcoming_bills: UpcomingBill[];
  balance_health: BalanceHealth;
  goal_opportunities: GoalOpportunity[];
  pending_approvals: number;
  insights: string[];
  recommended_action?: RecommendedAction;
}

export interface AutopilotResult {
  id: string;
  user_id: string;
  run_date: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  upcoming_bills: unknown[];
  balance_predictions: Record<string, unknown>;
  goal_opportunities: unknown[];
  recommendations: unknown[];
  error_message?: string;
  requires_attention: boolean;
  created_at: string;
  completed_at?: string;
}

// Request types
export interface CreatePlanRequest {
  title: string;
  description?: string;
  goal_type: string;
  priority?: PlanPriority;
  target_amount?: number;
  target_currency?: string;
}

export interface UpdatePlanRequest {
  title?: string;
  description?: string;
  priority?: PlanPriority;
  target_amount?: number;
  target_currency?: string;
}

export interface UpdateConfigRequest {
  enabled?: boolean;
  auto_approve_threshold?: number;
  auto_approve_currency?: string;
  require_biometric_above?: number;
  daily_autopilot_enabled?: boolean;
  autopilot_time?: string;
  autopilot_timezone?: string;
  allowed_action_types?: ActionType[];
  notification_preferences?: Record<string, boolean>;
}

export interface ApproveStepRequest {
  approval_method: 'manual' | 'biometric';
  device_info?: Record<string, unknown>;
}

export interface RejectStepRequest {
  reason: string;
}

// Response types
export interface PlansResponse {
  plans: AgentPlan[];
  total: number;
  limit: number;
  offset: number;
}

export interface PlanResponse {
  plan: AgentPlan;
}

export interface ApprovalsResponse {
  approvals: ActionApproval[];
}

export interface LogsResponse {
  logs: ActionLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface ConfigResponse {
  config: AgentConfig;
}

export interface BriefingResponse {
  briefing: DailyBriefing;
}

export interface AutopilotResponse {
  result: AutopilotResult;
}

// ============================================================================
// API Functions
// ============================================================================

export const agent = {
  // -------------------------------------------------------------------------
  // Plans
  // -------------------------------------------------------------------------
  
  /**
   * List user's financial plans
   */
  listPlans: (params?: { status?: PlanStatus; limit?: number; offset?: number }) =>
    fetchAPI<PlansResponse>('/agent/plans', {
      method: 'GET',
      ...(params && { 
        headers: { 
          'X-Query-Params': JSON.stringify(params) 
        } 
      }),
    }),

  /**
   * Get a specific plan by ID
   */
  getPlan: (planId: string) =>
    fetchAPI<PlanResponse>(`/agent/plans/${planId}`),

  /**
   * Create a new financial plan
   */
  createPlan: (data: CreatePlanRequest) =>
    fetchAPI<PlanResponse>('/agent/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Update a plan
   */
  updatePlan: (planId: string, data: UpdatePlanRequest) =>
    fetchAPI<PlanResponse>(`/agent/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /**
   * Delete (cancel) a plan
   */
  deletePlan: (planId: string) =>
    fetchAPI<{ message: string }>(`/agent/plans/${planId}`, {
      method: 'DELETE',
    }),

  /**
   * Activate a plan
   */
  activatePlan: (planId: string) =>
    fetchAPI<PlanResponse>(`/agent/plans/${planId}/activate`, {
      method: 'POST',
    }),

  /**
   * Pause a plan
   */
  pausePlan: (planId: string) =>
    fetchAPI<PlanResponse>(`/agent/plans/${planId}/pause`, {
      method: 'POST',
    }),

  /**
   * Resume a paused plan
   */
  resumePlan: (planId: string) =>
    fetchAPI<PlanResponse>(`/agent/plans/${planId}/resume`, {
      method: 'POST',
    }),

  // -------------------------------------------------------------------------
  // Steps & Approvals
  // -------------------------------------------------------------------------

  /**
   * Approve a pending step
   */
  approveStep: (planId: string, stepId: string, data: ApproveStepRequest) =>
    fetchAPI<{ message: string; step: PlanStep }>(`/agent/plans/${planId}/steps/${stepId}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Reject a pending step
   */
  rejectStep: (planId: string, stepId: string, data: RejectStepRequest) =>
    fetchAPI<{ message: string; step: PlanStep }>(`/agent/plans/${planId}/steps/${stepId}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /**
   * Get all pending approvals
   */
  getPendingApprovals: () =>
    fetchAPI<ApprovalsResponse>('/agent/approvals/pending'),

  // -------------------------------------------------------------------------
  // Configuration
  // -------------------------------------------------------------------------

  /**
   * Get agent configuration
   */
  getConfig: () =>
    fetchAPI<ConfigResponse>('/agent/config'),

  /**
   * Update agent configuration
   */
  updateConfig: (data: UpdateConfigRequest) =>
    fetchAPI<ConfigResponse>('/agent/config', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // -------------------------------------------------------------------------
  // Logs
  // -------------------------------------------------------------------------

  /**
   * Get action logs
   */
  getLogs: (params?: { limit?: number; offset?: number }) =>
    fetchAPI<LogsResponse>('/agent/logs', {
      method: 'GET',
      ...(params && {
        headers: {
          'X-Query-Params': JSON.stringify(params)
        }
      }),
    }),

  // -------------------------------------------------------------------------
  // Daily Briefing & Autopilot
  // -------------------------------------------------------------------------

  /**
   * Get daily financial briefing
   */
  getDailyBriefing: () =>
    fetchAPI<BriefingResponse>('/agent/briefing'),

  /**
   * Trigger manual autopilot scan
   */
  triggerAutopilot: () =>
    fetchAPI<AutopilotResponse>('/agent/autopilot/run', {
      method: 'POST',
    }),

  /**
   * Get latest autopilot result
   */
  getAutopilotResult: () =>
    fetchAPI<AutopilotResponse>('/agent/autopilot/result'),
};

export default agent;
