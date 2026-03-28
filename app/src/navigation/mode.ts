import { useEffect } from 'react';
import type { Router } from 'expo-router';
import { usePathname } from 'expo-router';
import { readStorage, writeStorage } from '../utils/storage';
import type { AddTransactionStep } from '../types/wallet';

export type AppMode = 'finapp' | 'todo';

export interface AddTransactionPrefill {
  type?: 'credit' | 'debit';
  amount?: number;
  currency?: string;
  wallet_currency?: string;
  category?: string;
  description?: string;
  linked_task_id?: string;
}

export const MODE_ENTRY_ROUTE: Record<AppMode, string> = {
  finapp: '/finapp',
  todo: '/todo',
};

export const MODE_DEFAULT_ROUTE: Record<AppMode, string> = {
  finapp: '/(app)/(tabs)',
  todo: '/(app)/(tabs)/planner',
};

const STORAGE_CURRENT_MODE = 'current_mode';
const STORAGE_LAST_ROUTE_FINAPP = 'last_route_finapp';
const STORAGE_LAST_ROUTE_TODO = 'last_route_todo';

const NON_APP_PREFIXES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/about', '/converter', '/auth'];
const TODO_PATH_PREFIXES = ['/todo', '/planner', '/(app)/planner', '/(app)/(tabs)/planner', '/planner-create', '/(app)/planner-create'] as const;
const TODO_TRANSIENT_PATHS = ['/planner-create', '/(app)/planner-create'] as const;
const FINAPP_TRANSIENT_PATHS = [
  '/(app)/(tabs)/add',
  '/add',
  '/transaction-create',
  '/(app)/transaction-create',
] as const;
const FINAPP_PATH_PREFIXES = [
  '/finapp',
  '/(app)/(tabs)',
  '/(app)/(tabs)/wallet',
  '/(app)/(tabs)/add',
  '/(app)/(tabs)/chat',
  '/(app)/coai-chat',
  '/(app)/(tabs)/reports',
  '/(app)/(tabs)/goals',
  '/wallet',
  '/add',
  '/chat',
  '/coai-chat',
  '/reports',
  '/goals',
  '/profile',
  '/tools',
  '/change-password',
  '/budgets',
  '/recurring',
  '/subscriptions',
  '/badges',
  '/historical',
  '/notes',
  '/note',
  '/loans',
  '/notification-settings',
  '/challenges',
  '/onboarding',
  '/transaction-create',
  '/(app)/transaction-create',
] as const;
const COMPATIBILITY_REDIRECTS: Record<string, string> = {
  '/(app)/planner': '/planner',
  '/(app)/finapp': '/finapp',
  '/(app)/todo': '/todo',
  '/index': '/(app)/(tabs)',
  '/(app)/(tabs)/index': '/(app)/(tabs)',
  '/chat': '/(app)/coai-chat',
  '/(app)/(tabs)/chat': '/(app)/coai-chat',
};

function normalizePath(path: string | null | undefined): string {
  if (!path) return '/';
  const trimmed = path.trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function canonicalizePath(path: string | null | undefined): string {
  const normalized = normalizePath(path);
  if (normalized === '/') {
    return '/';
  }
  return COMPATIBILITY_REDIRECTS[normalized] ?? normalized;
}

function getModeStorageKey(mode: AppMode): string {
  return mode === 'todo' ? STORAGE_LAST_ROUTE_TODO : STORAGE_LAST_ROUTE_FINAPP;
}

export function isTodoPath(path: string | null | undefined): boolean {
  const normalized = canonicalizePath(path);
  return TODO_PATH_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}

function isNonAppPath(path: string): boolean {
  return NON_APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isFinAppPath(path: string | null | undefined): boolean {
  const normalized = canonicalizePath(path);
  if (isTodoPath(normalized)) return false;
  if (isNonAppPath(normalized)) return false;
  return FINAPP_PATH_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix));
}

export function getModeFromPath(path: string | null | undefined): AppMode | null {
  const normalized = canonicalizePath(path);
  if (isNonAppPath(normalized)) return null;
  if (isTodoPath(normalized)) return 'todo';
  if (isFinAppPath(normalized)) return 'finapp';
  return null;
}

function isModeEntryPath(path: string | null | undefined): boolean {
  const normalized = canonicalizePath(path);
  return normalized === MODE_ENTRY_ROUTE.finapp || normalized === MODE_ENTRY_ROUTE.todo;
}

function canPersistRoute(path: string, mode: AppMode): boolean {
  if (isModeEntryPath(path)) return false;
  if (mode === 'todo' && TODO_TRANSIENT_PATHS.some((prefix) => matchesPrefix(path, prefix))) {
    return false;
  }
  if (mode === 'finapp' && FINAPP_TRANSIENT_PATHS.some((prefix) => matchesPrefix(path, prefix))) {
    return false;
  }
  return mode === 'todo' ? isTodoPath(path) : isFinAppPath(path);
}

function isModeRoute(mode: AppMode, path: string): boolean {
  return mode === 'todo' ? isTodoPath(path) : isFinAppPath(path);
}

export function getCompatibilityRedirectTarget(path: string | null | undefined): string | null {
  const normalized = normalizePath(path);
  return COMPATIBILITY_REDIRECTS[normalized] ?? null;
}

export async function setCurrentMode(mode: AppMode): Promise<void> {
  await writeStorage(STORAGE_CURRENT_MODE, mode);
}

export async function getCurrentMode(): Promise<AppMode> {
  const value = await readStorage(STORAGE_CURRENT_MODE);
  if (value === 'todo' || value === 'finapp') {
    return value;
  }
  return 'finapp';
}

export async function rememberModeRoute(mode: AppMode, route: string): Promise<void> {
  const normalized = canonicalizePath(route);
  if (!canPersistRoute(normalized, mode)) return;
  await writeStorage(getModeStorageKey(mode), normalized);
}

export async function getLastRouteForMode(mode: AppMode): Promise<string | null> {
  const stored = await readStorage(getModeStorageKey(mode));
  if (!stored) return null;

  const normalized = canonicalizePath(stored);
  if (mode === 'todo' && TODO_TRANSIENT_PATHS.some((prefix) => matchesPrefix(normalized, prefix))) {
    return null;
  }
  if (mode === 'finapp' && FINAPP_TRANSIENT_PATHS.some((prefix) => matchesPrefix(normalized, prefix))) {
    return null;
  }
  if (isModeRoute(mode, normalized)) {
    return normalized;
  }
  return null;
}

export async function getModeSwitchDestination(mode: AppMode): Promise<string> {
  const stored = await getLastRouteForMode(mode);
  if (stored) return stored;
  return MODE_ENTRY_ROUTE[mode];
}

export async function getModeEntryRedirect(mode: AppMode): Promise<string> {
  const stored = await getLastRouteForMode(mode);
  if (stored) return stored;
  return MODE_DEFAULT_ROUTE[mode];
}

export async function resolvePostAuthRoute(): Promise<string> {
  const mode = await getCurrentMode();
  const destination = await getModeSwitchDestination(mode);
  return destination;
}

export async function prepareDashboardPostAuthRoute(): Promise<string> {
  await setCurrentMode('finapp');
  await rememberModeRoute('finapp', MODE_DEFAULT_ROUTE.finapp);
  return MODE_ENTRY_ROUTE.finapp;
}

export async function switchAppMode(router: Router, targetMode: AppMode, currentPath?: string): Promise<void> {
  const destination = await getModeSwitchDestination(targetMode);
  await setCurrentMode(targetMode);

  const normalizedCurrent = canonicalizePath(currentPath);
  if (normalizedCurrent === destination) {
    return;
  }

  router.replace(destination as any);
}

export function usePersistModeRoute(isAuthenticated: boolean): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated) return;

    const normalized = canonicalizePath(pathname);
    const mode = getModeFromPath(normalized);
    if (!mode) return;

    void (async () => {
      await setCurrentMode(mode);
      await rememberModeRoute(mode, normalized);
    })();
  }, [isAuthenticated, pathname]);
}
