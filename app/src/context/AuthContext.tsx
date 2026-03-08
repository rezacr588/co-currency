import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import {
  api,
  setAuthToken,
  setRefreshToken,
  getAuthToken,
  getRefreshToken,
  clearAuthToken,
  setOnAuthError,
  loadTokens,
} from '../api';
import type { User, LoginRequest, RegisterRequest } from '../types/wallet';
import { isValidJWT } from '../utils/validation';
import { prepareDashboardPostAuthRoute, usePersistModeRoute } from '../navigation/mode';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  handleOAuthCallback: (token: string, refreshToken: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
// Query keys that are NOT user-scoped (safe to keep across sessions)
const PUBLIC_QUERY_KEYS = new Set(['currencies', 'exchange-rates', 'news']);

export function isAuthScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const [head] = queryKey;
  return typeof head === 'string' && !PUBLIC_QUERY_KEYS.has(head);
}

export async function clearAuthScopedQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.cancelQueries({
    predicate: (query) => isAuthScopedQueryKey(query.queryKey),
  });
  queryClient.removeQueries({
    predicate: (query) => isAuthScopedQueryKey(query.queryKey),
  });
}

// This hook protects routes by checking auth state
function useProtectedRoute(user: User | null, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!user && inAppGroup) {
      // Redirect to login if trying to access protected routes
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to dashboard if already logged in
      void (async () => {
        const target = await prepareDashboardPostAuthRoute();
        if (!active) return;
        router.replace(target as any);
      })();
    }

    return () => {
      active = false;
    };
  }, [user, segments, isLoading, router]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Protect routes based on auth state
  useProtectedRoute(user, isLoading);
  usePersistModeRoute(!!user && !isLoading);

  // Use a ref for the auth error callback to avoid stale closures
  const authErrorRef = useRef(() => {
    setUser(null);
    router.replace('/login');
  });
  useEffect(() => {
    authErrorRef.current = () => {
      setUser(null);
      router.replace('/login');
    };
  }, [router]);

  // Handle auth errors (401) - redirect to login
  useEffect(() => {
    setOnAuthError(() => {
      authErrorRef.current();
    });

    // Cleanup on unmount
    return () => {
      setOnAuthError(null);
    };
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.auth.getProfile();
      setUser(profile);
    } catch {
      // Token might be invalid, clear it
      await clearAuthToken();
      setUser(null);
    }
  }, []);

  // Load tokens and user on mount with retry logic
  useEffect(() => {
    async function loadUser() {
      try {
        // First, load tokens from secure storage into memory
        await loadTokens();

        const token = getAuthToken();
        if (token && isValidJWT(token)) {
          // Retry profile fetch up to 3 times for transient network errors
          const maxRetries = 3;
          let lastError: Error | null = null;

          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              const profile = await api.auth.getProfile();
              setUser(profile);
              return;
            } catch (error) {
              lastError = error instanceof Error ? error : new Error('Unknown error');

              // Check if it's a network error (worth retrying) vs auth error (don't retry)
              const isNetworkError =
                error instanceof TypeError || // Network failure
                (lastError.message && lastError.message.includes('network')) ||
                (lastError.message && lastError.message.includes('fetch'));

              const isAuthError =
                lastError.message?.includes('Session expired') ||
                lastError.message?.includes('401') ||
                lastError.message?.includes('Unauthorized');

              // Don't retry auth errors - just clear and continue
              if (isAuthError) {
                await clearAuthToken();
                break;
              }

              // Only retry network errors
              if (!isNetworkError || attempt === maxRetries - 1) {
                // Clear token on final failure if not a network error
                if (!isNetworkError) {
                  await clearAuthToken();
                }
                break;
              }

              // Wait before retry with exponential backoff
              await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
            }
          }
        }
      } finally {
        setIsLoading(false);
      }
    }
    loadUser();
  }, []);

  const login = async (data: LoginRequest) => {
    const response = await api.auth.login(data);
    await setAuthToken(response.token);
    if (response.refresh_token) {
      await setRefreshToken(response.refresh_token);
    }
    setUser(response.user);
  };

  const register = async (data: RegisterRequest) => {
    const response = await api.auth.register(data);
    await setAuthToken(response.token);
    if (response.refresh_token) {
      await setRefreshToken(response.refresh_token);
    }
    setUser(response.user);
  };

  const logout = useCallback(async () => {
    // Invalidate refresh token on server (best-effort, don't block on failure)
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      api.auth.logout(refreshToken).catch(() => {});
    }
    await clearAuthToken();
    await clearAuthScopedQueries(queryClient);
    setUser(null);
    router.replace('/login');
  }, [queryClient, router]);

  const handleOAuthCallback = useCallback(async (token: string, refreshToken: string) => {
    await setAuthToken(token);
    await setRefreshToken(refreshToken);
    // Fetch the user profile with the new token
    const profile = await api.auth.getProfile();
    setUser(profile);
  }, []);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
