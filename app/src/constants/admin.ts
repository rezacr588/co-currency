/**
 * Admin gate — kept in sync with the backend `ADMIN_EMAIL` env var
 * (`backend/internal/config/config.go`). The backend is authoritative; this
 * constant only controls UI visibility (showing the Admin entry in Profile,
 * letting the admin route render its dashboard). Even if a non-admin reaches
 * the route, the backend returns 403 for /api/v1/admin/* so no data leaks.
 */
export const ADMIN_EMAIL = 'rez.zet.int@gmail.com';

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
