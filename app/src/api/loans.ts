import { fetchAPI } from './base';
import { buildQuery } from './utils';
import type {
  Loan,
  LoanPayment,
  LoanSummary,
  CreateLoanRequest,
  UpdateLoanRequest,
  CreatePaymentRequest,
} from '../types/loan';

export const loans = {
  // Get all loans with optional filters
  list: (status?: string, type?: string) =>
    fetchAPI<{ loans: Loan[] }>(
      `/loans${buildQuery({ status, type })}`
    ),

  // Get a specific loan
  get: (id: string) =>
    fetchAPI<{ loan: Loan }>(`/loans/${id}`),

  // Create a new loan
  create: (data: CreateLoanRequest) =>
    fetchAPI<{ loan: Loan }>('/loans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Update a loan
  update: (id: string, data: UpdateLoanRequest) =>
    fetchAPI<{ loan: Loan }>(`/loans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Delete a loan
  delete: (id: string) =>
    fetchAPI<void>(`/loans/${id}`, {
      method: 'DELETE',
    }),

  // Make a payment on a loan
  makePayment: (id: string, data: CreatePaymentRequest) =>
    fetchAPI<{ payment: LoanPayment }>(`/loans/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get payments for a loan
  getPayments: (id: string) =>
    fetchAPI<{ payments: LoanPayment[] }>(`/loans/${id}/payments`),

  // Get loan summary
  getSummary: (currency?: string) =>
    fetchAPI<LoanSummary>(`/loans/summary${buildQuery({ currency })}`),

  // Get upcoming due loans
  getUpcoming: () =>
    fetchAPI<{ loans: Loan[] }>('/loans/upcoming'),
};
