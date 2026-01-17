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
}

// Wallet types
export interface WalletBalance {
  currency: string;
  amount: number;
  updated_at: string;
}

export interface WalletSummary {
  total_balance_usd: number;
  balances: WalletBalance[];
  recent_transactions: Transaction[];
}

export interface Transaction {
  id: string;
  type: 'credit' | 'debit' | 'convert' | 'convert_from' | 'convert_to';
  currency: string;
  amount: number;
  category?: string;
  description: string;
  created_at: string;
  balance_after?: number;
}

export interface TransactionRequest {
  type: 'credit' | 'debit';
  currency: string;
  amount: number;
  category?: string;
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
  name: string;
  icon?: string;
  color?: string;
  is_default?: boolean;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { name: 'food', icon: '🍔', color: '#ef4444', is_default: true },
  { name: 'transportation', icon: '🚗', color: '#f97316', is_default: true },
  { name: 'entertainment', icon: '🎬', color: '#eab308', is_default: true },
  { name: 'shopping', icon: '🛒', color: '#22c55e', is_default: true },
  { name: 'bills', icon: '📄', color: '#3b82f6', is_default: true },
  { name: 'income', icon: '💰', color: '#10b981', is_default: true },
  { name: 'transfer', icon: '↔️', color: '#8b5cf6', is_default: true },
  { name: 'other', icon: '📦', color: '#6b7280', is_default: true },
];

export interface WalletConvertRequest {
  from_currency: string;
  to_currency: string;
  amount: number;
}

export interface WalletConvertResponse {
  from_transaction: Transaction;
  to_transaction: Transaction;
  rate: number;
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

export interface AIApplyRequest {
  transactions: ParsedTransaction[];
}

export interface AIApplyResponse {
  applied_transactions: Transaction[];
  errors?: string[];
}
