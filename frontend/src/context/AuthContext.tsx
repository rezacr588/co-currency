import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { api, setAuthToken, getAuthToken, clearAuthToken } from '../api/client';
import type { User, LoginRequest, RegisterRequest } from '../types/wallet';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.auth.getProfile();
      setUser(profile);
    } catch {
      // Token might be invalid, clear it
      clearAuthToken();
      setUser(null);
    }
  }, []);

  // Load user on mount if token exists
  useEffect(() => {
    async function loadUser() {
      const token = getAuthToken();
      if (token) {
        try {
          const profile = await api.auth.getProfile();
          setUser(profile);
        } catch {
          // Token might be invalid, clear it
          clearAuthToken();
        }
      }
      setIsLoading(false);
    }
    loadUser();
  }, []);

  const login = async (data: LoginRequest) => {
    const response = await api.auth.login(data);
    setAuthToken(response.token);
    setUser(response.user);
  };

  const register = async (data: RegisterRequest) => {
    const response = await api.auth.register(data);
    setAuthToken(response.token);
    setUser(response.user);
  };

  const logout = () => {
    clearAuthToken();
    setUser(null);
  };

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
