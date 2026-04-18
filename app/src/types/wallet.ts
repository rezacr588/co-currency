// Authentication types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  has_linkedin_linked?: boolean;
  has_google_linked?: boolean;
  has_password?: boolean;
  onboarding_completed?: boolean;
  preferred_currency?: string;
  coai_focus_areas?: string[];
  weekly_brief_enabled?: boolean;
  proactive_alerts_enabled?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface UpdateProfileRequest {
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface ChangePasswordRequest {
  current_password?: string;
  new_password: string;
}

// Wallet types
export interface WalletBalance {
  id?: string;
  user_id?: string;
  currency: string;
  balance: number;
  updated_at: string;
}

export interface WalletSummary {
  total_balance_usd: number;
  balances: WalletBalance[];
  recent_transactions: Transaction[];
}

export interface Transaction {
  id: string;
  user_id?: string;
  type: 'credit' | 'debit' | 'convert' | 'convert_from' | 'convert_to';
  currency: string;
  amount: number;
  to_amount?: number;
  to_currency?: string;
  rate?: number;
  source?: string; // 'manual' | 'ai_receipt' | 'ai_invoice'
  category?: string;
  icon?: string;
  ai_extracted_data?: unknown;
  description: string;
  created_at: string;
  balance_after?: number;
}

export type AddTransactionStep = 'basics' | 'currency' | 'category' | 'review';

export interface TransactionRequest {
  type: 'credit' | 'debit';
  currency: string;           // Transaction currency (what you're paying/receiving in)
  wallet_currency?: string;   // Wallet currency to use (defaults to currency if not set)
  amount: number;
  category?: string;
  icon?: string;
  description?: string;
}

export interface UpdateTransactionRequest {
  type?: 'credit' | 'debit';
  currency?: string;
  amount?: number;
  category?: string;
  icon?: string;
  description?: string;
}

export interface AddTransactionDraft {
  version: number;
  updated_at: number;
  step: AddTransactionStep;
  type: 'credit' | 'debit';
  amount: string;
  currency: string;
  enable_target_conversion: boolean;
  wallet_currency: string;
  category: string;
  description: string;
}

export interface TransactionFilter {
  search?: string;
  category?: string;
  type?: string;
  currency?: string;
  from_date?: string;
  to_date?: string;
  from_ts?: string;
  to_ts?: string;
}

export interface Category {
  id?: string;
  user_id?: string;
  name: string;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

// Icon names correspond to keys in CATEGORY_ICONS from constants/icons.tsx.
// Category colors are sourced from the theme palette so they adapt to light/dark mode.
// Use `getDefaultCategories(theme)` with a styled-components theme object.
export type CategoryPaletteSource = {
  colors: {
    palette: {
      red: string;
      orange: string;
      yellow: string;
      green: string;
      blue: string;
      teal: string;
      purple: string;
      gray: string;
    };
  };
};

export function getDefaultCategories(source: CategoryPaletteSource): Category[] {
  const { palette } = source.colors;
  return [
    { name: 'food', icon: 'food', color: palette.red, is_default: true },
    { name: 'transportation', icon: 'transportation', color: palette.orange, is_default: true },
    { name: 'entertainment', icon: 'entertainment', color: palette.yellow, is_default: true },
    { name: 'shopping', icon: 'shopping', color: palette.green, is_default: true },
    { name: 'bills', icon: 'bills', color: palette.blue, is_default: true },
    { name: 'income', icon: 'income', color: palette.teal, is_default: true },
    { name: 'transfer', icon: 'transfer', color: palette.purple, is_default: true },
    { name: 'other', icon: 'other', color: palette.gray, is_default: true },
  ];
}

export interface WalletConvertRequest {
  from_currency: string;
  to_currency: string;
  amount: number;
}

export interface WalletConvertResponse {
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  rate: number;
  transaction?: Transaction;
}

// AI types
export interface AIParseRequest {
  text: string;
}

export interface ParsedTransaction {
  type: 'credit' | 'debit';
  currency: string;
  amount: number;
  description: string;
  confidence: number;
}

// AIParseResponse matches backend AIParseResult - single parsed transaction
export interface AIParseResponse {
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  description: string;
  confidence: number;
  raw_text?: string;
}

// AIApplyRequest - single transaction to apply (matches backend ApplyParsedRequest)
export interface AIApplyRequest {
  amount: number;
  currency: string;
  wallet_currency?: string; // Target wallet currency for cross-currency transactions
  type: 'credit' | 'debit';
  description: string;
}

// AIApplyResponse - backend returns single Transaction directly
export type AIApplyResponse = Transaction;

// IntentResponse - lightweight AI intent classification
export interface IntentResponse {
  intent: 'transaction' | 'recurring' | 'goal_contribution' | 'convert' | 'rate' | 'none';
}

// SmartParseResponse - enhanced AI parsing with action type detection
export interface SmartParseResponse {
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  description: string;
  category: string;
  action_type: 'transaction' | 'recurring' | 'goal_contribution' | 'convert' | 'rate' | 'none';
  frequency?: string;
  goal_name?: string;
  from_currency?: string;
  to_currency?: string;
  confidence: number;
  raw_text?: string;
}

// ApplyRecurringRequest - create recurring from AI parse
export interface ApplyRecurringRequest {
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  description: string;
  category?: string;
  frequency: string;
}

// ApplyGoalContributionRequest - contribute to goal from AI parse
export interface ApplyGoalContributionRequest {
  amount: number;
  goal_id?: string;
  goal_name?: string;
}
