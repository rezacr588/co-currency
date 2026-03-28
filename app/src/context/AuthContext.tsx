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
import { readSecureJSON, removeSecure, writeSecureJSON } from '../utils/storage';
import { markStartup } from '../utils/startupPerf';
import {
  isAuthErrorMessage,
  resolveAuthBootstrapFailure,
} from './authBootstrap';

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
const PROFILE_CACHE_KEY = '@auth_profile_cache';
// Query keys that are NOT user-scoped (safe to keep across sessions)
const PUBLIC_QUERY_KEYS = new Set(['currencies', 'exchange-rates', 'news']);

async function readCachedProfile(): Promise<User | null> {
  return readSecureJSON<User>(PROFILE_CACHE_KEY);
}

async function writeCachedProfile(user: User): Promise<void> {
  await writeSecureJSON(PROFILE_CACHE_KEY, user);
}

async function clearCachedProfile(): Promise<void> {
  await removeSecure(PROFILE_CACHE_KEY);
}

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
    // No else: if !user and in public group, or user and in public group, just stay there.
    // Public routes (landing, about) should be accessible to everyone.

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

  const clearSessionState = useCallback(async () => {
    await clearCachedProfile();
    await clearAuthToken();
    await clearAuthScopedQueries(queryClient);
    setUser(null);
  }, [queryClient]);

  // Use a ref for the auth error callback to avoid stale closures
  const authErrorRef = useRef(() => {
    void clearSessionState();
    router.replace('/login');
  });
  useEffect(() => {
    authErrorRef.current = () => {
      void clearSessionState();
      router.replace('/login');
    };
  }, [clearSessionState, router]);

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
      await writeCachedProfile(profile);
    } catch (error) {
      if (isAuthErrorMessage(error instanceof Error ? error.message : String(error))) {
        await clearSessionState();
        return;
      }

      const cachedProfile = await readCachedProfile();
      if (cachedProfile) {
        setUser(cachedProfile);
      }
    }
  }, [clearSessionState]);

  // Bootstrap auth with cached profile first, then refresh in the background.
  useEffect(() => {
    let active = true;
    let didFinishBootstrap = false;

    const finishBootstrap = () => {
      if (!active || didFinishBootstrap) return;
      didFinishBootstrap = true;
      setIsLoading(false);
      markStartup('auth_bootstrap_complete');
    };

    const clearBootstrapSession = async () => {
      await clearCachedProfile();
      await clearAuthToken();
      await clearAuthScopedQueries(queryClient);
      if (active) {
        setUser(null);
      }
    };

    const refreshProfileInBackground = async () => {
      try {
        const profile = await api.auth.getProfile();
        if (!active) return;
        setUser(profile);
        await writeCachedProfile(profile);
      } catch (error) {
        const action = resolveAuthBootstrapFailure(error, true);
        if (action === 'clear_session') {
          await clearBootstrapSession();
        }
      }
    };

    async function loadUser() {
      try {
        await loadTokens();

        const token = getAuthToken();
        if (!token) {
          return;
        }

        if (!isValidJWT(token)) {
          await clearBootstrapSession();
          return;
        }

        const cachedProfile = await readCachedProfile();
        if (cachedProfile) {
          if (active) {
            setUser(cachedProfile);
          }
          finishBootstrap();
          void refreshProfileInBackground();
          return;
        }

        try {
          const profile = await api.auth.getProfile();
          if (!active) return;
          setUser(profile);
          await writeCachedProfile(profile);
        } catch (error) {
          const action = resolveAuthBootstrapFailure(error, false);
          if (action === 'clear_session') {
            await clearBootstrapSession();
            return;
          }

          if (active) {
            setUser(null);
          }
        }
      } finally {
        finishBootstrap();
      }
    }
    void loadUser();

    return () => {
      active = false;
    };
  }, [queryClient]);

  const login = async (data: LoginRequest) => {
    const response = await api.auth.login(data);
    await setAuthToken(response.token);
    if (response.refresh_token) {
      await setRefreshToken(response.refresh_token);
    }
    setUser(response.user);
    await writeCachedProfile(response.user);
  };

  const register = async (data: RegisterRequest) => {
    const response = await api.auth.register(data);
    await setAuthToken(response.token);
    if (response.refresh_token) {
      await setRefreshToken(response.refresh_token);
    }
    setUser(response.user);
    await writeCachedProfile(response.user);
  };

  const logout = useCallback(async () => {
    // Invalidate refresh token on server (best-effort, don't block on failure)
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      api.auth.logout(refreshToken).catch(() => {});
    }
    await clearSessionState();
    router.replace('/login');
  }, [clearSessionState, router]);

  const handleOAuthCallback = useCallback(async (token: string, refreshToken: string) => {
    await setAuthToken(token);
    await setRefreshToken(refreshToken);
    // Fetch the user profile with the new token
    const profile = await api.auth.getProfile();
    setUser(profile);
    await writeCachedProfile(profile);
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
