/**
 * Social Finance API - Shared Spaces & Collaborative Budgets
 */

import { fetchAPI } from './base';
import { buildQuery } from './utils';

// ============ Types ============

export type SpaceType = 'couple' | 'family' | 'roommates' | 'trip' | 'project' | 'custom';
export type SpaceRole = 'owner' | 'admin' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type SplitMethod = 'equal' | 'percentage' | 'shares' | 'exact';
export type SettlementStatus = 'pending' | 'completed' | 'cancelled';

export interface SharedSpace {
  id: string;
  name: string;
  description: string;
  type: SpaceType;
  currency: string;
  icon: string;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  your_balance?: number;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: SpaceRole;
  nickname: string;
  joined_at: string;
  user_email?: string;
  user_name?: string;
}

export interface SpaceInvite {
  id: string;
  space_id: string;
  inviter_id: string;
  invitee_email: string;
  code: string;
  status: InviteStatus;
  role: SpaceRole;
  expires_at: string;
  created_at: string;
  space_name?: string;
  inviter_name?: string;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
  percentage?: number;
  shares?: number;
  is_paid: boolean;
  member_name?: string;
}

export interface SharedExpense {
  id: string;
  space_id: string;
  paid_by: string;
  title: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_method: SplitMethod;
  date: string;
  receipt_url: string;
  created_at: string;
  updated_at: string;
  paid_by_name?: string;
  splits?: ExpenseSplit[];
}

export interface Settlement {
  id: string;
  space_id: string;
  from_member: string;
  to_member: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  notes: string;
  settled_at?: string;
  created_at: string;
  from_member_name?: string;
  to_member_name?: string;
}

export interface SharedBudget {
  id: string;
  space_id: string;
  name: string;
  amount: number;
  currency: string;
  period: string;
  category: string;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  spent?: number;
  remaining?: number;
}

export interface BalanceSummary {
  member_id: string;
  member_name: string;
  user_id: string;
  total_paid: number;
  total_owed: number;
  net_balance: number;
}

export interface SpaceActivity {
  id: string;
  space_id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name?: string;
}

export interface SuggestedSettlement {
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount: number;
}

// ============ Request Types ============

export interface CreateSpaceRequest {
  name: string;
  description?: string;
  type: SpaceType;
  currency: string;
  icon?: string;
  color?: string;
}

export interface UpdateSpaceRequest {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface InviteMemberRequest {
  email: string;
  role?: SpaceRole;
}

export interface CreateExpenseRequest {
  title: string;
  description?: string;
  amount: number;
  currency: string;
  category?: string;
  split_method: SplitMethod;
  date?: string;
  receipt_url?: string;
  splits?: {
    member_id: string;
    amount?: number;
    percentage?: number;
    shares?: number;
  }[];
}

export interface UpdateExpenseRequest {
  title?: string;
  description?: string;
  amount?: number;
  category?: string;
  date?: string;
  receipt_url?: string;
}

export interface CreateSettlementRequest {
  to_member: string;
  amount: number;
  currency: string;
  notes?: string;
}

export interface CreateSharedBudgetRequest {
  name: string;
  amount: number;
  currency: string;
  period: string;
  category?: string;
  start_date: string;
  end_date?: string;
}

// ============ API Functions ============

// Spaces
export const getMySpaces = () =>
  fetchAPI<{ spaces: SharedSpace[] }>('/spaces');

export const getSpace = (spaceId: string) =>
  fetchAPI<{ space: SharedSpace }>(`/spaces/${spaceId}`);

export const createSpace = (data: CreateSpaceRequest) =>
  fetchAPI<{ space: SharedSpace }>('/spaces', { method: 'POST', body: JSON.stringify(data) });

export const updateSpace = (spaceId: string, data: UpdateSpaceRequest) =>
  fetchAPI<{ space: SharedSpace }>(`/spaces/${spaceId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSpace = (spaceId: string) =>
  fetchAPI<{ message: string }>(`/spaces/${spaceId}`, { method: 'DELETE' });

export const leaveSpace = (spaceId: string) =>
  fetchAPI<{ message: string }>(`/spaces/${spaceId}/leave`, { method: 'POST' });

// Members
export const getSpaceMembers = (spaceId: string) =>
  fetchAPI<{ members: SpaceMember[] }>(`/spaces/${spaceId}/members`);

export const inviteMember = (spaceId: string, data: InviteMemberRequest) =>
  fetchAPI<{ invite: SpaceInvite }>(`/spaces/${spaceId}/invite`, { method: 'POST', body: JSON.stringify(data) });

export const removeMember = (spaceId: string, memberId: string) =>
  fetchAPI<{ message: string }>(`/spaces/${spaceId}/members/${memberId}`, { method: 'DELETE' });

export const updateMemberRole = (spaceId: string, memberId: string, role: SpaceRole) =>
  fetchAPI<{ member: SpaceMember }>(`/spaces/${spaceId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ role }) });

// Invites
export const getMyInvites = () =>
  fetchAPI<{ invites: SpaceInvite[] }>('/spaces/invites');

export const respondToInvite = (inviteId: string, accept: boolean) =>
  fetchAPI<{ message: string; space?: SharedSpace }>(`/spaces/invites/${inviteId}/respond`, { method: 'POST', body: JSON.stringify({ accept }) });

export const joinByCode = (code: string) =>
  fetchAPI<{ message: string; space: SharedSpace }>('/spaces/join', { method: 'POST', body: JSON.stringify({ code }) });

// Expenses
export const getSpaceExpenses = (spaceId: string, params?: { limit?: number; offset?: number }) => {
  const query = buildQuery(params || {});
  return fetchAPI<{ expenses: SharedExpense[]; total: number }>(`/spaces/${spaceId}/expenses${query}`);
};

export const getExpense = (spaceId: string, expenseId: string) =>
  fetchAPI<{ expense: SharedExpense }>(`/spaces/${spaceId}/expenses/${expenseId}`);

export const createExpense = (spaceId: string, data: CreateExpenseRequest) =>
  fetchAPI<{ expense: SharedExpense }>(`/spaces/${spaceId}/expenses`, { method: 'POST', body: JSON.stringify(data) });

export const updateExpense = (spaceId: string, expenseId: string, data: UpdateExpenseRequest) =>
  fetchAPI<{ expense: SharedExpense }>(`/spaces/${spaceId}/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteExpense = (spaceId: string, expenseId: string) =>
  fetchAPI<{ message: string }>(`/spaces/${spaceId}/expenses/${expenseId}`, { method: 'DELETE' });

// Balances & Settlements
export const getBalanceSummary = (spaceId: string) =>
  fetchAPI<{ balances: BalanceSummary[]; currency: string }>(`/spaces/${spaceId}/balances`);

export const getSuggestedSettlements = (spaceId: string) =>
  fetchAPI<{ settlements: SuggestedSettlement[]; currency: string }>(`/spaces/${spaceId}/balances/settle`);

export const getSettlements = (spaceId: string, params?: { status?: SettlementStatus }) => {
  const query = buildQuery(params || {});
  return fetchAPI<{ settlements: Settlement[] }>(`/spaces/${spaceId}/settlements${query}`);
};

export const createSettlement = (spaceId: string, data: CreateSettlementRequest) =>
  fetchAPI<{ settlement: Settlement }>(`/spaces/${spaceId}/settlements`, { method: 'POST', body: JSON.stringify(data) });

export const completeSettlement = (spaceId: string, settlementId: string) =>
  fetchAPI<{ settlement: Settlement }>(`/spaces/${spaceId}/settlements/${settlementId}/complete`, { method: 'POST' });

export const cancelSettlement = (spaceId: string, settlementId: string) =>
  fetchAPI<{ settlement: Settlement }>(`/spaces/${spaceId}/settlements/${settlementId}/cancel`, { method: 'POST' });

// Shared Budgets
export const getSharedBudgets = (spaceId: string) =>
  fetchAPI<{ budgets: SharedBudget[] }>(`/spaces/${spaceId}/budgets`);

export const createSharedBudget = (spaceId: string, data: CreateSharedBudgetRequest) =>
  fetchAPI<{ budget: SharedBudget }>(`/spaces/${spaceId}/budgets`, { method: 'POST', body: JSON.stringify(data) });

export const updateSharedBudget = (spaceId: string, budgetId: string, data: Partial<CreateSharedBudgetRequest>) =>
  fetchAPI<{ budget: SharedBudget }>(`/spaces/${spaceId}/budgets/${budgetId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteSharedBudget = (spaceId: string, budgetId: string) =>
  fetchAPI<{ message: string }>(`/spaces/${spaceId}/budgets/${budgetId}`, { method: 'DELETE' });

// Activities
export const getSpaceActivities = (spaceId: string, limit?: number) => {
  const query = buildQuery({ limit });
  return fetchAPI<{ activities: SpaceActivity[] }>(`/spaces/${spaceId}/activities${query}`);
};

// Export all as namespace
export const social = {
  // Spaces
  getMySpaces,
  getSpace,
  createSpace,
  updateSpace,
  deleteSpace,
  leaveSpace,
  // Members
  getSpaceMembers,
  inviteMember,
  removeMember,
  updateMemberRole,
  // Invites
  getMyInvites,
  respondToInvite,
  joinByCode,
  // Expenses
  getSpaceExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  // Balances
  getBalanceSummary,
  getSuggestedSettlements,
  getSettlements,
  createSettlement,
  completeSettlement,
  cancelSettlement,
  // Budgets
  getSharedBudgets,
  createSharedBudget,
  updateSharedBudget,
  deleteSharedBudget,
  // Activities
  getSpaceActivities,
};
