import type { AuthResponse } from '../types/wallet';
import { readStorage, removeStorage, writeStorage } from '../utils/storage';

export const API_BASE = '/api/v1';

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

let authToken: string | null = null;
let refreshToken: string | null = null;

// Auth error callback - called when 401 is received
type AuthErrorCallback = () => void;
let onAuthErrorCallback: AuthErrorCallback | null = null;

export function setOnAuthError(callback: AuthErrorCallback | null) {
  onAuthErrorCallback = callback;
}

function handleAuthError() {
  clearAuthToken();
  if (onAuthErrorCallback) {
    onAuthErrorCallback();
  }
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    writeStorage(AUTH_TOKEN_KEY, token);
  } else {
    removeStorage(AUTH_TOKEN_KEY);
  }
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (token) {
    writeStorage(REFRESH_TOKEN_KEY, token);
  } else {
    removeStorage(REFRESH_TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = readStorage(AUTH_TOKEN_KEY);
  }
  return authToken;
}

export function getRefreshToken(): string | null {
  if (!refreshToken) {
    refreshToken = readStorage(REFRESH_TOKEN_KEY);
  }
  return refreshToken;
}

export function clearAuthToken() {
  authToken = null;
  refreshToken = null;
  removeStorage(AUTH_TOKEN_KEY);
  removeStorage(REFRESH_TOKEN_KEY);
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Single-flight pattern: prevent parallel token refreshes
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function doRefreshAuthToken(): Promise<boolean> {
  const storedRefreshToken = getRefreshToken();
  if (!storedRefreshToken) return false;

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: storedRefreshToken }),
    });

    if (response.ok) {
      const data: AuthResponse = await response.json();
      setAuthToken(data.token);
      if (data.refresh_token) {
        setRefreshToken(data.refresh_token);
      }
      return true;
    }
  } catch (error) {
    console.error('Failed to refresh token:', error);
  }

  // If refresh failed, clear tokens and logout
  handleAuthError();
  return false;
}

async function refreshAuthToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = doRefreshAuthToken().finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });

  return refreshPromise;
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
          ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          (errorData && typeof errorData.message === 'string' && errorData.message) ||
          (errorData && typeof errorData.error === 'string' && errorData.error) ||
          (errorData && typeof errorData.details === 'string' && errorData.details) ||
          `Request failed with status ${response.status}`;

        // Handle 401 Unauthorized - try to refresh token
        if (response.status === 401) {
          // If we haven't tried refreshing yet and have a refresh token
          if (attempt === 0 && getRefreshToken()) {
            const refreshed = await refreshAuthToken();
            if (refreshed) {
              // Retry the request immediately with the new token
              continue;
            }
          }

          handleAuthError();
          throw new Error('Session expired. Please log in again.');
        }

        // Don't retry on client errors (4xx), only server errors (5xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(errorMessage);
        }

        // Server error - will retry
        throw new Error(errorMessage || `Server error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry if it's a client error (except 401 which is handled above) or we've exhausted retries
      if (attempt === maxRetries) {
        break;
      }

      // Check if it's a network error or server error (worth retrying)
      const isRetryable =
        error instanceof TypeError || // Network error
        (lastError.message && lastError.message.includes('Server error'));

      if (!isRetryable && lastError.message !== 'Session expired. Please log in again.') {
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

export async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return fetchWithRetry<T>(`${API_BASE}${endpoint}`, options);
}
