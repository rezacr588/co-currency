import type { Router } from 'expo-router';
import type { RecommendedAction } from '../api/coai';

function normalizeActionPath(path: string): string {
  if (path === '/chat' || path === '/(app)/(tabs)/chat') {
    return '/(app)/coai-chat';
  }

  if (!path.startsWith('/')) {
    return `/${path}`;
  }

  return path;
}

function serializePrefillValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

export function buildRecommendedActionHref(action: RecommendedAction): any {
  const pathname = normalizeActionPath(action.target_route);
  const entries = Object.entries(action.prefill ?? {}).flatMap(([key, value]) => {
    const serialized = serializePrefillValue(value);
    return serialized === undefined ? [] : [[key, serialized] as const];
  });

  if (entries.length === 0) {
    return pathname as any;
  }

  return {
    pathname: pathname as any,
    params: Object.fromEntries(entries),
  };
}

export function openRecommendedAction(router: Router, action: RecommendedAction): void {
  router.push(buildRecommendedActionHref(action) as any);
}
