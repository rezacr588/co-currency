// Goal types
export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  category?: string;
  deadline?: string;
  progress: number;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalRequest {
  name: string;
  target_amount: number;
  currency: string;
  category?: string;
  deadline?: string;
}

export interface UpdateGoalRequest {
  name?: string;
  target_amount?: number;
  category?: string;
  deadline?: string;
}

export interface ContributeToGoalRequest {
  amount: number;
}

export const GOAL_CATEGORIES = [
  'savings',
  'emergency_fund',
  'vacation',
  'home',
  'car',
  'education',
  'retirement',
  'investment',
  'debt_payoff',
  'other',
] as const;

export type GoalCategory = typeof GOAL_CATEGORIES[number];

// Tag types
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface CreateTagRequest {
  name: string;
  color?: string;
}

// Budget types
export interface Budget {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'yearly';
  spent: number;
  remaining: number;
  progress: number;
  is_over_budget: boolean;
  is_near_limit: boolean;
  daily_allowance: number;
  remaining_days: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetRequest {
  category: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'yearly';
}

export interface UpdateBudgetRequest {
  amount?: number;
  period?: 'monthly' | 'yearly';
}

// Recurring transaction types
export interface RecurringTransaction {
  id: string;
  user_id: string;
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  category?: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_execution: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateRecurringRequest {
  type: 'credit' | 'debit';
  amount: number;
  currency: string;
  category?: string;
  description?: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_execution: string;
}

export interface UpdateRecurringRequest {
  type?: 'credit' | 'debit';
  amount?: number;
  category?: string;
  description?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  next_execution?: string;
  is_active?: boolean;
}

export const RECURRING_FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;

// Report types
export interface MonthlyReport {
  year: number;
  month: number;
  currency: string;
  income: number;
  expenses: number;
  net: number;
  savings_rate: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export interface CategoryReport {
  from_date: string;
  to_date: string;
  currency: string;
  total: number;
  categories: CategoryBreakdown[];
}

export interface TrendData {
  period: string;
  income: number;
  expenses: number;
  net: number;
}

export interface TrendsReport {
  currency: string;
  months: number;
  trends: TrendData[];
}

export interface BalanceBreakdown {
  currency: string;
  balance: number;
  balance_in_base: number;
  percentage: number;
}

export interface NetWorthReport {
  currency: string;
  total_balance: number;
  balances: BalanceBreakdown[];
}

// Subscription types
export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  currency: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  category?: string;
  next_billing_date: string;
  status: 'active' | 'paused' | 'cancelled';
  reminder_days: number;
  notes?: string;
  logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSubscriptionRequest {
  name: string;
  amount: number;
  currency: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  category?: string;
  next_billing_date: string;
  reminder_days?: number;
  notes?: string;
  logo_url?: string;
}

export interface UpdateSubscriptionRequest {
  name?: string;
  amount?: number;
  currency?: string;
  billing_cycle?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  category?: string;
  next_billing_date?: string;
  status?: 'active' | 'paused' | 'cancelled';
  reminder_days?: number;
  notes?: string;
  logo_url?: string;
}

export interface SubscriptionSummary {
  total_monthly: number;
  total_yearly: number;
  active_count: number;
  paused_count: number;
  cancelled_count: number;
  currency: string;
  by_category: Record<string, number>;
}

export const SUBSCRIPTION_BILLING_CYCLES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
export const SUBSCRIPTION_STATUSES = ['active', 'paused', 'cancelled'] as const;
export const SUBSCRIPTION_CATEGORIES = [
  'streaming',
  'software',
  'gaming',
  'fitness',
  'utilities',
  'news_media',
  'cloud_storage',
  'education',
  'food_delivery',
  'shopping',
  'finance',
  'productivity',
  'other',
] as const;

export type SubscriptionBillingCycle = typeof SUBSCRIPTION_BILLING_CYCLES[number];
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];
export type SubscriptionCategory = typeof SUBSCRIPTION_CATEGORIES[number];

// Badge types
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'savings' | 'streak' | 'budgeting' | 'special';
  requirement_type: string;
  requirement_value?: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  badge?: Badge;
  earned_at: string;
}

export interface BadgeProgress {
  badge: Badge;
  current_value: number;
  required_value: number;
  progress_percent: number;
  is_earned: boolean;
  earned_at?: string;
}

export interface BadgeCheckResult {
  newly_earned: UserBadge[];
  total_earned: number;
}

export const BADGE_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export const BADGE_CATEGORIES = ['milestone', 'savings', 'streak', 'budgeting', 'special'] as const;

export type BadgeRarity = typeof BADGE_RARITIES[number];
export type BadgeCategory = typeof BADGE_CATEGORIES[number];
