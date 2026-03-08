import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { AuthResponse } from '../types/wallet';
import { readSecure, writeSecure, removeSecure } from '../utils/storage';

// Production backend URL (always full URL for OAuth and native)
const BACKEND_URL = 'https://terrible-moselle-airez-1828dc33.koyeb.app/api/v1';

// Platform-aware API base URL
const getApiBase = (): string => {
  // On web in production, use relative path for same-origin requests
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Check if we're on the production domain
    if (window.location.hostname.includes('koyeb.app')) {
      return '/api/v1';
    }
    // In development, use full backend URL
    return BACKEND_URL;
  }
  // On native, use the full production URL
  const configuredUrl = Constants.expoConfig?.extra?.apiUrl;
  return configuredUrl || BACKEND_URL;
};

export const API_BASE = getApiBase();

// Always use full URL for OAuth (redirects need absolute URLs)
export const OAUTH_BASE = BACKEND_URL;

const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

// In-memory cache for tokens (faster access than async storage)
let authTokenCache: string | null = null;
let refreshTokenCache: string | null = null;
let tokensLoaded = false;
let loadTokensPromise: Promise<void> | null = null;

// Mutex for token refresh to prevent race conditions
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Auth error callback - called when 401 is received
type AuthErrorCallback = () => void;
let onAuthErrorCallback: AuthErrorCallback | null = null;

// Auth refresh callback - called when token is successfully refreshed
type TokenRefreshCallback = () => void;
let onTokenRefreshCallback: TokenRefreshCallback | null = null;

export function setOnTokenRefresh(callback: TokenRefreshCallback | null) {
  onTokenRefreshCallback = callback;
}

export function setOnAuthError(callback: AuthErrorCallback | null) {
  onAuthErrorCallback = callback;
}

function handleAuthError() {
  clearAuthToken();
  if (onAuthErrorCallback) {
    onAuthErrorCallback();
  }
}

// Load tokens from storage into memory cache
export async function loadTokens(): Promise<void> {
  if (tokensLoaded) return;
  if (loadTokensPromise) return loadTokensPromise;

  loadTokensPromise = (async () => {
    const [token, refresh] = await Promise.all([
      readSecure(AUTH_TOKEN_KEY),
      readSecure(REFRESH_TOKEN_KEY),
    ]);

    authTokenCache = token;
    refreshTokenCache = refresh;
    tokensLoaded = true;
    loadTokensPromise = null;
  })();

  return loadTokensPromise;
}

export async function setAuthToken(token: string | null): Promise<void> {
  authTokenCache = token;
  if (token) {
    const persisted = await writeSecure(AUTH_TOKEN_KEY, token);
    if (!persisted && __DEV__) {
      console.warn('[Auth] Failed to persist auth token to secure storage');
    }
  } else {
    await removeSecure(AUTH_TOKEN_KEY);
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  refreshTokenCache = token;
  if (token) {
    const persisted = await writeSecure(REFRESH_TOKEN_KEY, token);
    if (!persisted && __DEV__) {
      console.warn('[Auth] Failed to persist refresh token to secure storage');
    }
  } else {
    await removeSecure(REFRESH_TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return authTokenCache;
}

export function getRefreshToken(): string | null {
  return refreshTokenCache;
}

export async function clearAuthToken(): Promise<void> {
  authTokenCache = null;
  refreshTokenCache = null;
  tokensLoaded = false;
  loadTokensPromise = null;
  await Promise.all([
    removeSecure(AUTH_TOKEN_KEY),
    removeSecure(REFRESH_TOKEN_KEY),
  ]);
}

interface FetchAPIOptions extends RequestInit {
  isFormData?: boolean;
  preserveUnauthorized?: boolean;
}

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function refreshAuthToken(): Promise<boolean> {
  // If already refreshing, wait for the existing refresh to complete
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  const storedRefreshToken = getRefreshToken();
  if (!storedRefreshToken) return false;

  // Set mutex and create promise for concurrent callers
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: storedRefreshToken }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data: AuthResponse = await response.json();
        await setAuthToken(data.token);
        if (data.refresh_token) {
          await setRefreshToken(data.refresh_token);
        }
        
        // Notify application that token was refreshed
        if (onTokenRefreshCallback) {
          onTokenRefreshCallback();
        }
        
        return true;
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }

    // If refresh failed, clear tokens and logout
    handleAuthError();
    return false;
  })();

  try {
    return await refreshPromise;
  } finally {
    // Reset mutex after completion
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function fetchWithRetry<T>(
  url: string,
  options?: FetchAPIOptions,
  retryOptions: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 1, baseDelay = 1000, maxDelay = 10000 } = retryOptions;
  const isFormData = options?.isFormData ?? false;
  const preserveUnauthorized = options?.preserveUnauthorized ?? false;

  // Ensure tokens are loaded before first request
  await loadTokens();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const token = getAuthToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      const headers: Record<string, string> = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options?.headers as Record<string, string> ?? {}),
      };
      // Don't set Content-Type for FormData — let the browser set it with boundary
      if (!isFormData) {
        headers['Content-Type'] = 'application/json';
      }
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage =
          (errorData && typeof errorData.message === 'string' && errorData.message) ||
          (errorData && typeof errorData.error === 'string' && errorData.error) ||
          (errorData && typeof errorData.details === 'string' && errorData.details) ||
          `Request failed with status ${response.status}`;

        // Handle 401 Unauthorized - try to refresh token
        if (response.status === 401) {
          if (preserveUnauthorized) {
            throw new Error(errorMessage);
          }

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

        // Server error - will retry (prefix with "Server error:" so retry logic detects it)
        throw new Error(`Server error: ${errorMessage || `status ${response.status}`}`);
      }

      // 204 No Content has no body to parse
      if (response.status === 204) {
        return undefined as T;
      }
      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry if it's a client error (except 401 which is handled above) or we've exhausted retries
      if (attempt === maxRetries) {
        break;
      }

      // Check if it's a network error, timeout, or server error (worth retrying)
      const isAbortError =
        (error as any)?.name === 'AbortError' ||
        lastError.message.includes('Aborted') ||
        lastError.message.includes('timeout');
      const isRetryable =
        error instanceof TypeError || // Network error
        isAbortError || // Timeout (platform-agnostic: DOMException on web, Error on native)
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

export async function fetchAPI<T>(endpoint: string, options?: FetchAPIOptions): Promise<T> {
  return fetchWithRetry<T>(`${API_BASE}${endpoint}`, options);
}
