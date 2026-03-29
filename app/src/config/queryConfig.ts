/**
 * Centralized TanStack Query staleTime tiers.
 *
 * Import the appropriate constant when declaring useQuery() so staleness
 * is consistent across the app and easy to tune in one place.
 */

/** Chat messages, agent pending actions — refreshed often */
export const STALE_REALTIME = 30_000; // 30 seconds

/** Dashboard summary, balances, active conversations */
export const STALE_FREQUENT = 60_000; // 1 minute

/** Transactions, budgets, goals, planner board (global default) */
export const STALE_STANDARD = 5 * 60_000; // 5 minutes

/** Forecasting, anomaly detection, news */
export const STALE_SLOW = 15 * 60_000; // 15 minutes

/** Currencies, exchange rates, historical data */
export const STALE_STATIC = 60 * 60_000; // 1 hour
