import { getLocales } from 'expo-localization';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS } from './constants';

export interface CurrencyDisplay {
  flag: string | undefined;
  symbol: string;
}

function getLocale(): string {
  const locales = getLocales();
  if (locales.length > 0 && locales[0].languageTag) {
    return locales[0].languageTag;
  }
  return 'en-US';
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

export function formatCurrency(
  amount: number,
  currency: string,
  options: Intl.NumberFormatOptions = {}
): string {
  try {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(
  amount: number,
  decimalsOrOptions: number | Intl.NumberFormatOptions = 2
): string {
  if (!isFinite(amount)) return '0.00';
  if (typeof decimalsOrOptions === 'number') {
    const safeDecimals = Math.min(Math.max(0, decimalsOrOptions), 20);
    return new Intl.NumberFormat(getLocale(), {
      minimumFractionDigits: Math.min(2, safeDecimals),
      maximumFractionDigits: safeDecimals,
    }).format(amount);
  }
  return new Intl.NumberFormat(getLocale(), decimalsOrOptions).format(amount);
}

export function formatRate(rate: number): string {
  if (!isFinite(rate)) return '0.000000';
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  }).format(rate);
}

export function formatCompactCurrency(
  amount: number,
  currency: string,
  options: Intl.NumberFormatOptions = {}
): string {
  if (!isFinite(amount)) {
    return formatCurrency(0, currency, options);
  }
  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount, currency, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      ...options,
    });
  }
  try {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
      ...options,
    }).format(amount);
  } catch {
    return formatCurrency(amount, currency, options);
  }
}

/**
 * Format a transaction amount with sign prefix (+ for credit, - for debit).
 * For cross-currency transactions, displays the wallet (converted) amount.
 */
export function formatTransactionAmount(tx: {
  type: string;
  amount: number;
  currency: string;
  to_amount?: number | null;
  to_currency?: string | null;
}): string {
  const amount = tx.to_amount ?? tx.amount;
  const currency = tx.to_currency ?? tx.currency;
  const sign = tx.type === 'credit' ? '+' : '-';
  return `${sign}${formatCompactCurrency(amount, currency)}`;
}

/**
 * Get the effective display currency for a transaction.
 * Returns wallet currency for cross-currency transactions, otherwise the original.
 */
export function getTransactionCurrency(tx: {
  currency: string;
  to_currency?: string | null;
}): string {
  return tx.to_currency ?? tx.currency;
}

export function formatDate(
  date: string,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }
): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const locale = getLocale();
  const formatOptions = { ...options };

  // Support Jalali calendar for Persian locale
  if (locale.startsWith('fa')) {
    (formatOptions as Record<string, unknown>).calendar = 'persian';
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(d);
}

export function formatTime(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'N/A';

  const locale = getLocale();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  };

  // Support Jalali calendar for Persian locale
  if (locale.startsWith('fa')) {
    (options as Record<string, unknown>).calendar = 'persian';
  }

  return new Intl.DateTimeFormat(locale, options).format(d);
}
