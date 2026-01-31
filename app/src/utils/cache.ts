import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@cache_';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  staleWhileRevalidate?: boolean;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// Get cached data
export async function getCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
}

// Set cached data
export async function setCache<T>(
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const now = Date.now();

  const entry: CacheEntry<T> = {
    data,
    timestamp: now,
    expiresAt: now + ttl,
  };

  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error('Cache set error:', error);
  }
}

// Check if cache is expired
export function isExpired<T>(entry: CacheEntry<T>): boolean {
  return Date.now() > entry.expiresAt;
}

// Check if cache is stale (expired but still usable)
export function isStale<T>(entry: CacheEntry<T>): boolean {
  return isExpired(entry);
}

// Remove cached data
export async function removeCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('Cache remove error:', error);
  }
}

// Clear all cached data
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter((k) => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

// Get or fetch with caching
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const cached = await getCache<T>(key);

  // If we have valid cached data
  if (cached && !isExpired(cached)) {
    return cached.data;
  }

  // If stale-while-revalidate is enabled and we have stale data
  if (options.staleWhileRevalidate && cached) {
    // Return stale data immediately, refresh in background
    fetcher()
      .then((data) => setCache(key, data, options))
      .catch(() => {});
    return cached.data;
  }

  // Fetch fresh data
  try {
    const data = await fetcher();
    await setCache(key, data, options);
    return data;
  } catch (error) {
    // If fetch fails and we have stale data, return it
    if (cached) {
      return cached.data;
    }
    throw error;
  }
}

// Cache keys for commonly cached data
export const CacheKeys = {
  USER_PROFILE: 'user_profile',
  WALLET_BALANCES: 'wallet_balances',
  WALLET_SUMMARY: 'wallet_summary',
  TRANSACTIONS: 'transactions',
  CATEGORIES: 'categories',
  EXCHANGE_RATES: 'exchange_rates',
  CURRENCIES: 'currencies',
  GOALS: 'goals',
  BUDGETS: 'budgets',
} as const;

// Pre-configured cache durations
export const CacheTTL = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours
} as const;
