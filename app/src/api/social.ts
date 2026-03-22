/**
 * Social Finance API - Shared Spaces & Collaborative Budgets
 * Backend contract source: backend/internal/handler/social.go
 */

import { fetchAPI } from './base';
import { buildQuery } from './utils';

// ============ Types ============

export type SpaceType = 'couple' | 'family' | 'roommates' | 'trip' | 'project' | 'custom';
export type SpaceRole = 'owner' | 'admin' | 'member';
export type InviteStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type SplitMethod = 'equal' | 'percentage' | 'shares' | 'exact';
export type SettlementStatus = 'pending' | 'completed' | 'cancelled';

export interface SpaceSettings {
  allow_member_invites?: boolean;
  require_approval?: boolean;
  default_split_method?: string;
  notify_on_expense?: boolean;
  notify_on_settlement?: boolean;
  monthly_budget_limit?: number;
  auto_settlement_day?: number;
}

export interface SharedSpace {
  id: string;
  name: string;
  description?: string;
  type: SpaceType;
  currency: string;
  icon_emoji?: string;
  settings?: SpaceSettings;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  members?: SpaceMember[];

  // UI compatibility fields
  icon?: string;
  color?: string;
  your_balance?: number;
}

export interface SpaceMember {
  id: string;
  space_id: string;
  user_id: string;
  role: SpaceRole;
  nickname?: string;
  joined_at: string;
  invited_by?: string;
  user_email?: string;
  user_name?: string;
  avatar_url?: string;
  balance?: number;
}

export interface SpaceInvite {
  id: string;
  space_id: string;
  inviter_id: string;
  invitee_email: string;
  invitee_id?: string;
  code: string;
  role: SpaceRole;
  expires_at: string;
  accepted_at?: string;
  rejected_at?: string;
  created_at: string;
  space_name?: string;
  inviter_name?: string;
  status?: InviteStatus;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number;
  percentage?: number;
  shares?: number;
  is_paid: boolean;
  paid_at?: string;
  user_name?: string;

  // UI compatibility fields
  member_id?: string;
  member_name?: string;
}

export interface SharedExpense {
  id: string;
  space_id: string;
  paid_by_user_id: string;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  split_method: SplitMethod;
  splits?: ExpenseSplit[];
  receipt_url?: string;
  notes?: string;
  expense_date: string;
  created_at: string;
  updated_at?: string;
  paid_by_name?: string;

  // UI compatibility fields
  paid_by?: string;
  title?: string;
  date?: string;
}

export interface Settlement {
  id: string;
  space_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  currency: string;
  method?: string;
  notes?: string;
  settled_at: string;
  confirmed_at?: string;
  created_at: string;
  from_user_name?: string;
  to_user_name?: string;

  // UI compatibility fields
  from_member?: string;
  to_member?: string;
  status?: SettlementStatus;
  from_member_name?: string;
  to_member_name?: string;
}

export interface SharedBudget {
  id: string;
  space_id: string;
  name: string;
  category?: string;
  amount: number;
  currency: string;
  period: string;
  start_date: string;
  end_date?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  spent?: number;
  remaining?: number;
  percentage?: number;
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
  user_id: string;
  type: string;
  ref_id?: string;
  message: string;
  data?: Record<string, unknown>;
  created_at: string;
  user_name?: string;
  avatar_url?: string;
}

export interface SuggestedSettlement {
  from_member_id: string;
  from_member_name: string;
  to_member_id: string;
  to_member_name: string;
  amount: number;
}

interface BackendBalanceSummary {
  space_id: string;
  total_owed: number;
  total_owes: number;
  net_balance: number;
  balances: Array<{
    user_id: string;
    user_name: string;
    balance: number;
  }>;
  simplify?: Array<{
    from_user_id: string;
    to_user_id: string;
    amount: number;
    from_user_name?: string;
    to_user_name?: string;
  }>;
}

// ============ Request Types ============

export interface CreateSpaceRequest {
  name: string;
  description?: string;
  type: SpaceType;
  currency: string;
  icon_emoji?: string;
  settings?: SpaceSettings;

  // UI-only field
  color?: string;
}

export interface UpdateSpaceRequest {
  name?: string;
  description?: string;
  icon_emoji?: string;
  settings?: SpaceSettings;
  color?: string;
}

export interface InviteMemberRequest {
  email: string;
  role?: SpaceRole;
}

export interface CreateExpenseRequest {
  title?: string;
  description?: string;
  amount: number;
  currency: string;
  category?: string;
  split_method: SplitMethod;
  date?: string;
  receipt_url?: string;
  notes?: string;
  splits?: {
    member_id?: string;
    user_id?: string;
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
  to_member?: string;
  to_user_id?: string;
  amount: number;
  currency: string;
  method?: string;
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

// ============ Helpers ============

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function inviteStatus(invite: SpaceInvite): InviteStatus {
  if (invite.accepted_at) return 'accepted';
  if (invite.rejected_at) return 'declined';
  if (new Date(invite.expires_at).getTime() <= Date.now()) return 'expired';
  return 'pending';
}

function normalizeSpace(space: SharedSpace): SharedSpace {
  return {
    ...space,
    icon: space.icon_emoji || space.icon,
  };
}

function normalizeExpense(expense: SharedExpense): SharedExpense {
  const splits = expense.splits?.map((split) => ({
    ...split,
    member_id: split.member_id || split.user_id,
    member_name: split.member_name || split.user_name,
  }));

  return {
    ...expense,
    splits,
    paid_by: expense.paid_by || expense.paid_by_user_id,
    title: expense.title || expense.description,
    date: expense.date || expense.expense_date,
  };
}

function normalizeSettlement(settlement: Settlement): Settlement {
  return {
    ...settlement,
    from_member: settlement.from_member || settlement.from_user_id,
    to_member: settlement.to_member || settlement.to_user_id,
    from_member_name: settlement.from_member_name || settlement.from_user_name,
    to_member_name: settlement.to_member_name || settlement.to_user_name,
    status: settlement.status || (settlement.confirmed_at ? 'completed' : 'pending'),
  };
}

async function resolveInviteCode(inviteCodeOrID: string): Promise<string> {
  if (!isUUID(inviteCodeOrID)) {
    return inviteCodeOrID;
  }

  const invites = await getMyInvites();
  const matched = invites.invites.find((invite) => invite.id === inviteCodeOrID);
  return matched?.code || inviteCodeOrID;
}

// ============ API Functions ============

// Spaces
export async function getMySpaces() {
  const response = await fetchAPI<{ spaces: SharedSpace[] }>('/spaces');
  return {
    spaces: (response.spaces || []).map(normalizeSpace),
  };
}

export async function getSpace(spaceId: string) {
  const space = await fetchAPI<SharedSpace>(`/spaces/${spaceId}`);
  return {
    space: normalizeSpace(space),
  };
}

export async function createSpace(data: CreateSpaceRequest) {
  const payload = {
    name: data.name,
    description: data.description || '',
    type: data.type,
    currency: data.currency,
    icon_emoji: data.icon_emoji || '',
    settings: data.settings,
  };
  const space = await fetchAPI<SharedSpace>('/spaces', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { space: normalizeSpace(space) };
}

export async function updateSpace(spaceId: string, data: UpdateSpaceRequest) {
  await fetchAPI<{ message: string }>(`/spaces/${spaceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      icon_emoji: data.icon_emoji,
      settings: data.settings,
    }),
  });
  return getSpace(spaceId);
}

export function deleteSpace(spaceId: string) {
  return fetchAPI<{ message: string }>(`/spaces/${spaceId}`, { method: 'DELETE' });
}

export function leaveSpace(spaceId: string) {
  return fetchAPI<{ message: string }>(`/spaces/${spaceId}/leave`, { method: 'POST' });
}

// Members
export async function getSpaceMembers(spaceId: string) {
  const { space } = await getSpace(spaceId);
  return { members: space.members || [] };
}

export async function inviteMember(spaceId: string, data: InviteMemberRequest) {
  const invite = await fetchAPI<SpaceInvite>(`/spaces/${spaceId}/invite`, {
    method: 'POST',
    body: JSON.stringify({
      email: data.email,
      role: data.role || 'member',
    }),
  });
  return {
    invite: {
      ...invite,
      status: inviteStatus(invite),
    },
  };
}

export async function removeMember(spaceId: string, memberId: string) {
  let targetID = memberId;
  if (!isUUID(memberId)) {
    return Promise.reject(new Error('invalid member id'));
  }

  // Backend expects user_id in URL. If UI passed row id, resolve it.
  const { members } = await getSpaceMembers(spaceId);
  const byRowID = members.find((member) => member.id === memberId);
  if (byRowID?.user_id) {
    targetID = byRowID.user_id;
  }

  return fetchAPI<{ message: string }>(`/spaces/${spaceId}/members/${targetID}`, { method: 'DELETE' });
}

export async function updateMemberRole(_spaceId: string, _memberId: string, _role: SpaceRole) {
  throw new Error('Updating member role is not supported by backend yet');
}

// Invites
export async function getMyInvites() {
  const response = await fetchAPI<{ invites: SpaceInvite[] }>('/spaces/invites');
  return {
    invites: (response.invites || []).map((invite) => ({
      ...invite,
      status: inviteStatus(invite),
    })),
  };
}

export async function respondToInvite(inviteCodeOrID: string, accept: boolean) {
  const code = await resolveInviteCode(inviteCodeOrID);
  return fetchAPI<{ message: string; space?: SharedSpace }>(`/spaces/invites/${code}/respond`, {
    method: 'POST',
    body: JSON.stringify({ accept }),
  });
}

export async function joinByCode(code: string) {
  const space = await fetchAPI<SharedSpace>(`/spaces/invites/${code}/accept`, { method: 'POST' });
  return {
    message: 'joined',
    space: normalizeSpace(space),
  };
}

// Expenses
export async function getSpaceExpenses(spaceId: string, params?: { limit?: number; offset?: number }) {
  const query = buildQuery(params || {});
  const response = await fetchAPI<{ expenses: SharedExpense[]; total: number }>(`/spaces/${spaceId}/expenses${query}`);
  return {
    expenses: (response.expenses || []).map(normalizeExpense),
    total: response.total || 0,
  };
}

export async function getExpense(_spaceId: string, expenseId: string) {
  const expense = await fetchAPI<SharedExpense>(`/spaces/expenses/${expenseId}`);
  return { expense: normalizeExpense(expense) };
}

export async function createExpense(spaceId: string, data: CreateExpenseRequest) {
  const payload = {
    amount: data.amount,
    currency: data.currency,
    description: data.description || data.title || '',
    category: data.category || '',
    split_method: data.split_method,
    splits: (data.splits || []).map((split) => ({
      user_id: split.user_id || split.member_id,
      amount: split.amount,
      percentage: split.percentage,
      shares: split.shares,
    })),
    receipt_url: data.receipt_url || '',
    notes: data.notes || '',
    expense_date: data.date,
  };

  const expense = await fetchAPI<SharedExpense>(`/spaces/${spaceId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return { expense: normalizeExpense(expense) };
}

export async function updateExpense(_spaceId: string, _expenseId: string, _data: UpdateExpenseRequest) {
  throw new Error('Updating expenses is not supported by backend yet');
}

export function deleteExpense(_spaceId: string, expenseId: string) {
  return fetchAPI<{ message: string }>(`/spaces/expenses/${expenseId}`, { method: 'DELETE' });
}

// Balances & Settlements
export async function getBalanceSummary(spaceId: string) {
  const summary = await fetchAPI<BackendBalanceSummary>(`/spaces/${spaceId}/balances`);
  const balances: BalanceSummary[] = (summary.balances || []).map((balance) => {
    const net = balance.balance || 0;
    return {
      member_id: balance.user_id,
      member_name: balance.user_name,
      user_id: balance.user_id,
      total_paid: net > 0 ? net : 0,
      total_owed: net < 0 ? -net : 0,
      net_balance: net,
    };
  });

  return {
    balances,
    currency: '',
  };
}

export async function getSuggestedSettlements(spaceId: string) {
  const summary = await fetchAPI<BackendBalanceSummary>(`/spaces/${spaceId}/balances`);
  const settlements: SuggestedSettlement[] = (summary.simplify || []).map((settlement) => ({
    from_member_id: settlement.from_user_id,
    from_member_name: settlement.from_user_name || 'Member',
    to_member_id: settlement.to_user_id,
    to_member_name: settlement.to_user_name || 'Member',
    amount: settlement.amount,
  }));
  return {
    settlements,
    currency: '',
  };
}

export async function getSettlements(spaceId: string, params?: { limit?: number; offset?: number; status?: SettlementStatus }) {
  const query = buildQuery({
    limit: params?.limit,
    offset: params?.offset,
  });
  const response = await fetchAPI<{ settlements: Settlement[] }>(`/spaces/${spaceId}/settlements${query}`);
  return {
    settlements: (response.settlements || []).map(normalizeSettlement),
  };
}

export async function createSettlement(spaceId: string, data: CreateSettlementRequest) {
  const settlement = await fetchAPI<Settlement>(`/spaces/${spaceId}/settlements`, {
    method: 'POST',
    body: JSON.stringify({
      to_user_id: data.to_user_id || data.to_member,
      amount: data.amount,
      currency: data.currency,
      method: data.method || '',
      notes: data.notes || '',
    }),
  });
  return { settlement: normalizeSettlement(settlement) };
}

export function completeSettlement(_spaceId: string, settlementId: string) {
  return fetchAPI<{ message: string }>(`/spaces/settlements/${settlementId}/confirm`, { method: 'POST' });
}

export async function cancelSettlement(_spaceId: string, _settlementId: string) {
  throw new Error('Cancelling settlements is not supported by backend yet');
}

// Shared Budgets
export function getSharedBudgets(spaceId: string) {
  return fetchAPI<{ budgets: SharedBudget[] }>(`/spaces/${spaceId}/budgets`);
}

export async function createSharedBudget(spaceId: string, data: CreateSharedBudgetRequest) {
  const budget = await fetchAPI<SharedBudget>(`/spaces/${spaceId}/budgets`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return { budget };
}

export async function updateSharedBudget(_spaceId: string, _budgetId: string, _data: Partial<CreateSharedBudgetRequest>) {
  throw new Error('Updating shared budgets is not supported by backend yet');
}

export async function deleteSharedBudget(_spaceId: string, _budgetId: string) {
  throw new Error('Deleting shared budgets is not supported by backend yet');
}

// Activities
export function getSpaceActivities(spaceId: string, limit?: number) {
  const query = buildQuery({ limit });
  return fetchAPI<{ activities: SpaceActivity[] }>(`/spaces/${spaceId}/activities${query}`);
}

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
