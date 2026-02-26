import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import {
  api,
  setAuthToken,
  setRefreshToken,
  getAuthToken,
  clearAuthToken,
  setOnAuthError,
  loadTokens,
} from '../api';
import type { User, LoginRequest, RegisterRequest } from '../types/wallet';
import { isValidJWT } from '../utils/validation';
import { resolvePostAuthRoute, usePersistModeRoute } from '../navigation/mode';

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
        const target = await resolvePostAuthRoute();
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
    await clearAuthToken();
    setUser(null);
    router.replace('/login');
  }, [router]);

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
