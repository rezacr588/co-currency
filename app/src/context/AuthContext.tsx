import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
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
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';

    if (!user && inAppGroup) {
      // Redirect to login if trying to access protected routes
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirect to dashboard if already logged in
      router.replace('/(app)/(tabs)');
    }
  }, [user, segments, isLoading, router]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Protect routes based on auth state
  useProtectedRoute(user, isLoading);

  // Handle auth errors (401) - redirect to login
  useEffect(() => {
    setOnAuthError(() => {
      setUser(null);
      router.replace('/login');
    });

    // Cleanup on unmount
    return () => {
      setOnAuthError(null);
    };
  }, [router]);

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

  // Load tokens and user on mount
  useEffect(() => {
    async function loadUser() {
      // First, load tokens from secure storage into memory
      await loadTokens();

      const token = getAuthToken();
      if (token) {
        try {
          const profile = await api.auth.getProfile();
          setUser(profile);
        } catch {
          // Token might be invalid, clear it
          await clearAuthToken();
        }
      }
      setIsLoading(false);
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
