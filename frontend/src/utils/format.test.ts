import { describe, it, expect, beforeAll } from 'vitest';
import {
  formatNumber,
  formatRate,
  formatTime,
  getCurrencyDisplay,
  getRateChangeStatus,
  calculatePercentChange,
} from './format';

beforeAll(() => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = 'en-US';
  }
});

describe('formatNumber', () => {
  it('should format integers with commas', () => {
    expect(formatNumber(1000)).toContain('1,000');
    expect(formatNumber(1000000)).toContain('1,000,000');
  });

  it('should format decimals correctly', () => {
    expect(formatNumber(1234.56)).toContain('1,234');
    expect(formatNumber(0.123456, 4)).toBe('0.1235');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toContain('0');
  });

  it('should handle negative numbers', () => {
    expect(formatNumber(-1000)).toContain('-1,000');
  });

  it('should respect decimal places parameter', () => {
    expect(formatNumber(100, 0)).toBe('100');
    expect(formatNumber(100, 2)).toBe('100.00');
  });
});

describe('formatRate', () => {
  it('should format exchange rates with appropriate precision', () => {
    expect(formatRate(1.2345)).toMatch(/1\.234/);
  });

  it('should handle very small rates', () => {
    const result = formatRate(0.00001234);
    expect(result).toBeTruthy();
  });

  it('should handle large rates', () => {
    const result = formatRate(42000);
    expect(result).toMatch(/42/);
  });
});

describe('formatTime', () => {
  it('should format ISO date string', () => {
    const isoString = '2026-01-06T10:30:00Z';
    const result = formatTime(isoString);
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});

describe('getCurrencyDisplay', () => {
  it('should return flag and symbol for known currencies', () => {
    const usd = getCurrencyDisplay('USD');
    expect(usd.flag).toBe('🇺🇸');
    expect(usd.symbol).toBe('$');

    const eur = getCurrencyDisplay('EUR');
    expect(eur.flag).toBe('🇪🇺');
    expect(eur.symbol).toBe('€');

    const gbp = getCurrencyDisplay('GBP');
    expect(gbp.flag).toBe('🇬🇧');
    expect(gbp.symbol).toBe('£');
  });

  it('should return undefined flag for unknown currencies', () => {
    const unknown = getCurrencyDisplay('XYZ');
    expect(unknown.flag).toBeUndefined();
    expect(unknown.symbol).toBe('XYZ');
  });

  it('should handle IRR currency', () => {
    const irr = getCurrencyDisplay('IRR');
    expect(irr.flag).toBe('🇮🇷');
    expect(irr.symbol).toBe('﷼');
  });
});

describe('getRateChangeStatus', () => {
  it('should return "up" when current rate is higher', () => {
    expect(getRateChangeStatus(1.5, 1.0)).toBe('up');
    expect(getRateChangeStatus(100, 99.99)).toBe('up');
  });

  it('should return "down" when current rate is lower', () => {
    expect(getRateChangeStatus(1.0, 1.5)).toBe('down');
    expect(getRateChangeStatus(99, 100)).toBe('down');
  });

  it('should return "neutral" when rates are equal', () => {
    expect(getRateChangeStatus(1.0, 1.0)).toBe('neutral');
    expect(getRateChangeStatus(0, 0)).toBe('neutral');
  });
});

describe('calculatePercentChange', () => {
  it('should calculate positive percent change', () => {
    expect(calculatePercentChange(110, 100)).toBe(10);
    expect(calculatePercentChange(150, 100)).toBe(50);
  });

  it('should calculate negative percent change', () => {
    expect(calculatePercentChange(90, 100)).toBe(-10);
    expect(calculatePercentChange(50, 100)).toBe(-50);
  });

  it('should return 0 when previous value is 0', () => {
    expect(calculatePercentChange(100, 0)).toBe(0);
  });

  it('should handle decimal values', () => {
    const result = calculatePercentChange(1.1, 1.0);
    expect(result).toBeCloseTo(10, 5);
  });
});
