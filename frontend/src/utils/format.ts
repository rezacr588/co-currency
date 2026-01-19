import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from './constants';

export interface CurrencyDisplay {
  flag: string | undefined;
  symbol: string;
}

/**
 * Get display information for a currency code
 * Returns the flag emoji (or undefined if not found) and symbol for a given currency
 * When flag is undefined, consumers should render a Globe icon as fallback
 */
export function getCurrencyDisplay(code: string): CurrencyDisplay {
  return {
    flag: CURRENCY_FLAGS[code],
    symbol: CURRENCY_SYMBOLS[code] || code,
  };
}

/**
 * Get the rate change status for displaying UI indicators
 */
export function getRateChangeStatus(currentRate: number, previousRate: number): 'up' | 'down' | 'neutral' {
  if (currentRate > previousRate) return 'up';
  if (currentRate < previousRate) return 'down';
  return 'neutral';
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(amount: number, decimals = 2): string {
  if (!isFinite(amount)) return '0.00';
  const safeDecimals = Math.min(Math.max(0, decimals), 20);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.min(2, safeDecimals),
    maximumFractionDigits: safeDecimals,
  }).format(amount);
}

export function formatRate(rate: number): string {
  if (!isFinite(rate)) return '0.000000';
  return rate.toFixed(6);
}

export function formatDate(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
