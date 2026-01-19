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
  onboarding_completed?: boolean;
  created_at: string;
  updated_at?: string;
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

export interface TransactionFilter {
  search?: string;
  category?: string;
  type?: string;
  currency?: string;
  from_date?: string;
  to_date?: string;
}

export interface Category {
  id?: string;
  user_id?: string;
  name: string;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

// Icon names correspond to keys in CATEGORY_ICONS from constants/icons.tsx
export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'food', icon: 'food', color: '#ef4444', is_default: true },
  { name: 'transportation', icon: 'transportation', color: '#f97316', is_default: true },
  { name: 'entertainment', icon: 'entertainment', color: '#eab308', is_default: true },
  { name: 'shopping', icon: 'shopping', color: '#22c55e', is_default: true },
  { name: 'bills', icon: 'bills', color: '#3b82f6', is_default: true },
  { name: 'income', icon: 'income', color: '#10b981', is_default: true },
  { name: 'transfer', icon: 'transfer', color: '#8b5cf6', is_default: true },
  { name: 'other', icon: 'other', color: '#6b7280', is_default: true },
];

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

export interface AIParseResponse {
  transactions: ParsedTransaction[];
  raw_text: string;
}

// AIApplyRequest - single transaction to apply (matches backend ApplyParsedRequest)
export interface AIApplyRequest {
  amount: number;
  currency: string;
  type: 'credit' | 'debit';
  description: string;
}

// AIApplyResponse - backend returns single Transaction directly
export type AIApplyResponse = Transaction;
