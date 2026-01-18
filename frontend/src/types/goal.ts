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
