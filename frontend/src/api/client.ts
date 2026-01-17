import type { Currency, RatesResponse, ConversionResult, ConversionRequest } from '../types';
import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  AuthResponse,
  User,
  WalletBalance,
  WalletSummary,
  Transaction,
  TransactionRequest,
  TransactionFilter,
  WalletConvertRequest,
  WalletConvertResponse,
  AIParseRequest,
  AIParseResponse,
  AIApplyRequest,
  AIApplyResponse,
  Category,
} from '../types/wallet';
import type {
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest,
  ContributeToGoalRequest,
  Tag,
  CreateTagRequest,
  Budget,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  RecurringTransaction,
  CreateRecurringRequest,
  UpdateRecurringRequest,
  MonthlyReport,
  CategoryReport,
  TrendsReport,
  NetWorthReport,
} from '../types/goal';

const API_BASE = '/api/v1';

// Token management
let authToken: string | null = null;
let refreshToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (token) {
    localStorage.setItem('refresh_token', token);
  } else {
    localStorage.removeItem('refresh_token');
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

export function getRefreshToken(): string | null {
  if (!refreshToken) {
    refreshToken = localStorage.getItem('refresh_token');
  }
  return refreshToken;
}

export function clearAuthToken() {
  authToken = null;
  refreshToken = null;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  retryOptions: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const token = getAuthToken();
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options?.headers,
        },
      });

      if (!response.ok) {
        // Don't retry on client errors (4xx), only server errors (5xx)
        if (response.status >= 400 && response.status < 500) {
          const error = await response.json().catch(() => ({ message: 'API request failed' }));
          throw new Error(error.message || 'API request failed');
        }

        // Server error - will retry
        throw new Error(`Server error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry if it's a client error or we've exhausted retries
      if (attempt === maxRetries) {
        break;
      }

      // Check if it's a network error or server error (worth retrying)
      const isRetryable =
        error instanceof TypeError || // Network error
        (lastError.message && lastError.message.includes('Server error'));

      if (!isRetryable) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      const jitter = delay * 0.1 * Math.random(); // 10% jitter
      await sleep(delay + jitter);
    }
  }

  throw lastError || new Error('API request failed');
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return fetchWithRetry<T>(`${API_BASE}${endpoint}`, options);
}

export const api = {
  currencies: {
    list: () => fetchAPI<Currency[]>('/currencies'),
  },
  rates: {
    latest: (base: string) => fetchAPI<RatesResponse>(`/rates/${base}`),
    historical: (date: string, base: string) =>
      fetchAPI<RatesResponse>(`/historical/${date}?base=${base}`),
  },
  convert: (params: ConversionRequest) =>
    fetchAPI<ConversionResult>(
      `/convert?from=${params.from}&to=${params.to}&amount=${params.amount}`
    ),

  // Authentication
  auth: {
    register: (data: RegisterRequest) =>
      fetchAPI<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    login: (data: LoginRequest) =>
      fetchAPI<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getProfile: () => fetchAPI<User>('/auth/profile'),
    forgotPassword: (data: ForgotPasswordRequest) =>
      fetchAPI<{ message: string; token?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    resetPassword: (data: ResetPasswordRequest) =>
      fetchAPI<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    refresh: (data: RefreshTokenRequest) =>
      fetchAPI<AuthResponse>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    logout: (refreshToken?: string) =>
      fetchAPI<{ message: string }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
  },

  // Wallet
  wallet: {
    getBalances: () => fetchAPI<{ balances: WalletBalance[] }>('/wallet/balances'),
    getSummary: () => fetchAPI<WalletSummary>('/wallet/summary'),
    getTransactions: (limit?: number, offset?: number, filter?: TransactionFilter) => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', limit.toString());
      if (offset) params.set('offset', offset.toString());
      if (filter) {
        if (filter.search) params.set('search', filter.search);
        if (filter.category) params.set('category', filter.category);
        if (filter.type) params.set('type', filter.type);
        if (filter.currency) params.set('currency', filter.currency);
        if (filter.from_date) params.set('from_date', filter.from_date);
        if (filter.to_date) params.set('to_date', filter.to_date);
      }
      const query = params.toString();
      return fetchAPI<{ transactions: Transaction[]; total: number; limit: number; offset: number }>(
        `/wallet/transactions${query ? `?${query}` : ''}`
      );
    },
    addTransaction: (data: TransactionRequest) =>
      fetchAPI<Transaction>('/wallet/transaction', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    convert: (data: WalletConvertRequest) =>
      fetchAPI<WalletConvertResponse>('/wallet/convert', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getCategories: () => fetchAPI<{ categories: Category[] }>('/wallet/categories'),
    exportTransactions: (format: string = 'csv', filter?: TransactionFilter) => {
      const params = new URLSearchParams();
      params.set('format', format);
      if (filter) {
        if (filter.search) params.set('search', filter.search);
        if (filter.category) params.set('category', filter.category);
        if (filter.type) params.set('type', filter.type);
        if (filter.currency) params.set('currency', filter.currency);
        if (filter.from_date) params.set('from_date', filter.from_date);
        if (filter.to_date) params.set('to_date', filter.to_date);
      }
      // Return the URL for downloading
      return `${API_BASE}/wallet/transactions/export?${params.toString()}`;
    },
  },

  // AI
  ai: {
    parseReceipt: (data: AIParseRequest) =>
      fetchAPI<AIParseResponse>('/ai/parse', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    applyParsed: (data: AIApplyRequest) =>
      fetchAPI<AIApplyResponse>('/ai/apply', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Goals
  goals: {
    list: () => fetchAPI<{ goals: Goal[] }>('/goals'),
    get: (id: string) => fetchAPI<{ goal: Goal; progress: number; is_completed: boolean }>(`/goals/${id}`),
    create: (data: CreateGoalRequest) =>
      fetchAPI<{ goal: Goal; progress: number; is_completed: boolean }>('/goals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateGoalRequest) =>
      fetchAPI<{ goal: Goal; progress: number; is_completed: boolean }>(`/goals/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<{ message: string }>(`/goals/${id}`, {
        method: 'DELETE',
      }),
    contribute: (id: string, data: ContributeToGoalRequest) =>
      fetchAPI<{ goal: Goal; progress: number; is_completed: boolean; transaction: Transaction }>(`/goals/${id}/contribute`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getCategories: () => fetchAPI<{ categories: string[] }>('/goals/categories'),
  },

  // Tags
  tags: {
    list: () => fetchAPI<{ tags: Tag[] }>('/tags'),
    create: (data: CreateTagRequest) =>
      fetchAPI<Tag>('/tags', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<{ message: string }>(`/tags/${id}`, {
        method: 'DELETE',
      }),
  },

  // Budgets
  budgets: {
    list: () => fetchAPI<{ budgets: Budget[] }>('/budgets'),
    create: (data: CreateBudgetRequest) =>
      fetchAPI<{ budget: Budget }>('/budgets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateBudgetRequest) =>
      fetchAPI<{ budget: Budget }>(`/budgets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<{ message: string }>(`/budgets/${id}`, {
        method: 'DELETE',
      }),
  },

  // Recurring Transactions
  recurring: {
    list: () => fetchAPI<{ recurring_transactions: RecurringTransaction[] }>('/recurring'),
    create: (data: CreateRecurringRequest) =>
      fetchAPI<RecurringTransaction>('/recurring', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateRecurringRequest) =>
      fetchAPI<RecurringTransaction>(`/recurring/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetchAPI<{ message: string }>(`/recurring/${id}`, {
        method: 'DELETE',
      }),
    execute: (id: string) =>
      fetchAPI<{ transaction: Transaction; recurring_transaction: RecurringTransaction }>(`/recurring/${id}/execute`, {
        method: 'POST',
      }),
  },

  // Reports
  reports: {
    monthly: (year?: number, month?: number, currency?: string) => {
      const params = new URLSearchParams();
      if (year) params.set('year', year.toString());
      if (month) params.set('month', month.toString());
      if (currency) params.set('currency', currency);
      const query = params.toString();
      return fetchAPI<MonthlyReport>(`/reports/monthly${query ? `?${query}` : ''}`);
    },
    category: (fromDate?: string, toDate?: string, currency?: string) => {
      const params = new URLSearchParams();
      if (fromDate) params.set('from_date', fromDate);
      if (toDate) params.set('to_date', toDate);
      if (currency) params.set('currency', currency);
      const query = params.toString();
      return fetchAPI<CategoryReport>(`/reports/category${query ? `?${query}` : ''}`);
    },
    trends: (months?: number, currency?: string) => {
      const params = new URLSearchParams();
      if (months) params.set('months', months.toString());
      if (currency) params.set('currency', currency);
      const query = params.toString();
      return fetchAPI<TrendsReport>(`/reports/trends${query ? `?${query}` : ''}`);
    },
    networth: (currency?: string) => {
      const params = new URLSearchParams();
      if (currency) params.set('currency', currency);
      const query = params.toString();
      return fetchAPI<NetWorthReport>(`/reports/networth${query ? `?${query}` : ''}`);
    },
  },
};
