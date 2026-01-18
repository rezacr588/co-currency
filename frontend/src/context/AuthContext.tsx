import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, setAuthToken, getAuthToken, clearAuthToken, setOnAuthError } from '../api/client';
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
  const navigate = useNavigate();
  const location = useLocation();

  // Handle auth errors (401) - redirect to login
  useEffect(() => {
    setOnAuthError(() => {
      setUser(null);
      // Only redirect if we're on a protected route (not already on login/register)
      const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/about'];
      const isPublicPath = publicPaths.some(path =>
        location.pathname === path || location.pathname.startsWith('/reset-password')
      );

      if (!isPublicPath) {
        // Save current path to redirect back after login
        navigate('/login', {
          state: { from: location.pathname },
          replace: true
        });
      }
    });

    // Cleanup on unmount
    return () => {
      setOnAuthError(null);
    };
  }, [navigate, location.pathname]);

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

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

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
