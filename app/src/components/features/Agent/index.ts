/**
 * Agent Feature Components
 *
 * Components for the Autonomous AI Financial Agent dashboard:
 * - AgentStatusHero: at-a-glance health pill + projected balance + run scan
 * - ApprovalsBanner: high-priority CTA when actions await approval
 * - TodaySection: top recommendation + nearest bills
 * - RoadmapSection: goal opportunities with progress
 * - RecentActivitySection: last few executed actions, builds trust
 * - PlanCard: individual plan display with steps
 * - ApprovalCard: pending action approval interface (used on /agent/approvals)
 */

export { AgentStatusHero } from './AgentStatusHero';
export { ApprovalsBanner } from './ApprovalsBanner';
export { TodaySection } from './TodaySection';
export { RoadmapSection } from './RoadmapSection';
export { RecentActivitySection } from './RecentActivitySection';
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
