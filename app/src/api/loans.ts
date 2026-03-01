import { fetchAPI } from './base';
import { buildQuery } from './utils';
import { createCRUDApi } from './crud';
import type {
  Loan,
  LoanPayment,
  LoanSummary,
  CreateLoanRequest,
  UpdateLoanRequest,
  CreatePaymentRequest,
} from '../types/loan';

const crud = createCRUDApi<
  { loans: Loan[] },
  { loan: Loan },
  CreateLoanRequest,
  { loan: Loan },
  UpdateLoanRequest,
  { loan: Loan },
  void
>('/loans');

export const loans = {
  ...crud,

  // Override list to support filters
  list: (status?: string, type?: string) =>
    fetchAPI<{ loans: Loan[] }>(
      `/loans${buildQuery({ status, type })}`
    ),

  makePayment: (id: string, data: CreatePaymentRequest) =>
    fetchAPI<{ payment: LoanPayment }>(`/loans/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPayments: (id: string) =>
    fetchAPI<{ payments: LoanPayment[] }>(`/loans/${id}/payments`),

  getSummary: (currency?: string) =>
    fetchAPI<LoanSummary>(`/loans/summary${buildQuery({ currency })}`),

  getUpcoming: () =>
    fetchAPI<{ loans: Loan[] }>('/loans/upcoming'),
};
