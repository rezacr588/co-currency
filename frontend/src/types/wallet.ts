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

export interface AuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
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
  type: 'credit' | 'debit' | 'convert_from' | 'convert_to';
  currency: string;
  amount: number;
  description: string;
  created_at: string;
  balance_after: number;
}

export interface TransactionRequest {
  type: 'credit' | 'debit';
  currency: string;
  amount: number;
  description?: string;
}

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
