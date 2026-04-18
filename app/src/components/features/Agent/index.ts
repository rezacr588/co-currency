/**
 * Agent Feature Components
 *
 * Components for the Autonomous AI Financial Agent feature:
 * - AutopilotCard: 4-stage autopilot view (Onramp / Roadmap / Daily Plan / Actions)
 * - PlanCard: Individual plan display with steps
 * - ApprovalCard: Pending action approval interface
 */

export { AutopilotCard } from './AutopilotCard';
export { PlanCard } from './PlanCard';
export { ApprovalCard } from './ApprovalCard';

// Re-export types from API for convenience
export type {
  AgentPlan,
  PlanStep,
  ActionApproval,
  AgentConfig,
  DailyBriefing,
  UpcomingBill,
  BalanceHealth,
  GoalOpportunity,
  RecommendedAction,
  AutopilotResult,
  PlanStatus,
  StepStatus,
  ActionType,
} from '../../../api/agent';
