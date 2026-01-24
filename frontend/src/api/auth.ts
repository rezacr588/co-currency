import type {
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  RefreshTokenRequest,
  AuthResponse,
  User,
} from '../types/wallet';
import { API_BASE, fetchAPI } from './base';

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
  // GitHub OAuth
  getGitHubAuthUrl: () => `${API_BASE}/auth/github`,
  getGitHubLinkUrl: () => fetchAPI<{ url: string }>('/auth/github/link'),
  linkGitHub: (code: string) =>
    fetchAPI<{ message: string }>(`/auth/github/link?code=${code}`, {
      method: 'POST',
    }),
  unlinkGitHub: () =>
    fetchAPI<{ message: string }>('/auth/github/link', {
      method: 'DELETE',
    }),
};
