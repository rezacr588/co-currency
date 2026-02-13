// TODO: API responses are not runtime-validated. Consider adding a schema validation
// library (e.g., zod) for critical endpoints to catch backend contract changes early.
import type {
  WalletBalance,
  WalletSummary,
  Transaction,
  TransactionRequest,
  UpdateTransactionRequest,
  TransactionFilter,
  WalletConvertRequest,
  WalletConvertResponse,
  Category,
} from '../types/wallet';
import { API_BASE, fetchAPI } from './base';
import { buildQuery } from './utils';

export const wallet = {
  getBalances: () => fetchAPI<{ balances: WalletBalance[] }>('/wallet/balances'),
  getSummary: () => fetchAPI<WalletSummary>('/wallet/summary'),
  getTransactions: (limit?: number, offset?: number, filter?: TransactionFilter) => {
    const query = buildQuery({
      limit: limit || undefined,
      offset: offset || undefined,
      ...(filter || {}),
    });
    return fetchAPI<{ transactions: Transaction[]; total: number; limit: number; offset: number }>(
      `/wallet/transactions${query}`
    );
  },
  addTransaction: (data: TransactionRequest) =>
    fetchAPI<Transaction>('/wallet/transaction', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getTransaction: (id: string) => fetchAPI<Transaction>(`/wallet/transactions/${id}`),
  updateTransaction: (id: string, data: UpdateTransactionRequest) =>
    fetchAPI<Transaction>(`/wallet/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTransaction: (id: string) =>
    fetchAPI<{ message: string }>(`/wallet/transactions/${id}`, {
      method: 'DELETE',
    }),
  importTransactions: (transactions: TransactionRequest[]) =>
    fetchAPI<{ message: string; count: number }>('/wallet/transactions/import', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    }),
  convert: (data: WalletConvertRequest) =>
    fetchAPI<WalletConvertResponse>('/wallet/convert', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getCategories: () => fetchAPI<{ categories: Category[] }>('/wallet/categories'),
  createCategory: (data: { name: string; icon?: string; color?: string }) =>
    fetchAPI<Category>('/wallet/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    fetchAPI<{ message: string }>(`/wallet/categories/${id}`, {
      method: 'DELETE',
    }),
  exportTransactions: (format: string = 'csv', filter?: TransactionFilter) => {
    const query = buildQuery({
      format,
      ...(filter || {}),
    });
    return `${API_BASE}/wallet/transactions/export${query}`;
  },
};
