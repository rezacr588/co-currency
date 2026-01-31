export type LoanType = 'borrowed' | 'lent';
export type LoanStatus = 'active' | 'paid_off' | 'defaulted' | 'forgiven';
export type PaymentType = 'payment' | 'interest' | 'forgiveness';

export interface Loan {
  id: string;
  user_id: string;
  type: LoanType;
  name: string;
  description?: string;
  principal_amount: number;
  remaining_amount: number;
  currency: string;
  interest_rate: number;
  counterparty?: string;
  due_date?: string;
  status: LoanStatus;
  created_at: string;
  updated_at: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  amount: number;
  currency: string;
  payment_type: PaymentType;
  notes?: string;
  created_at: string;
}

export interface CreateLoanRequest {
  type: LoanType;
  name: string;
  description?: string;
  principal_amount: number;
  currency: string;
  interest_rate?: number;
  counterparty?: string;
  due_date?: string;
}

export interface UpdateLoanRequest {
  name?: string;
  description?: string;
  interest_rate?: number;
  counterparty?: string;
  due_date?: string;
  status?: LoanStatus;
}

export interface CreatePaymentRequest {
  amount: number;
  payment_type: PaymentType;
  notes?: string;
}

export interface LoanSummary {
  currency: string;
  total_borrowed: number;
  total_lent: number;
  remaining_borrowed: number;
  remaining_lent: number;
  net_debt: number;
  active_loans_count: number;
}
