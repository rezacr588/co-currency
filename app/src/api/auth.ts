import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  AuthResponse,
  User,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from '../types/wallet';
import { OAUTH_BASE, fetchAPI } from './base';

export const auth = {
  register: (data: RegisterRequest) =>
    fetchAPI<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  login: (data: LoginRequest) =>
    fetchAPI<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
      preserveUnauthorized: true,
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
  updateProfile: (data: UpdateProfileRequest) =>
    fetchAPI<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  changePassword: (data: ChangePasswordRequest) =>
    fetchAPI<{ message: string }>('/auth/password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  logout: (refreshToken?: string) =>
    fetchAPI<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    }),
  completeOnboarding: () =>
    fetchAPI<User>('/auth/onboarding/complete', {
      method: 'POST',
    }),
  // LinkedIn OAuth
  getLinkedInAuthUrl: () => `${OAUTH_BASE}/auth/linkedin`,
  // Google OAuth
  getGoogleAuthUrl: () => `${OAUTH_BASE}/auth/google`,
};
