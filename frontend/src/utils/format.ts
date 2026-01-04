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
  const safeDecimals = Math.min(Math.max(0, decimals), 20);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Math.min(2, safeDecimals),
    maximumFractionDigits: safeDecimals,
  }).format(amount);
}

export function formatRate(rate: number): string {
  return rate.toFixed(6);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatTime(date: string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
