import { describe, it, expect } from 'vitest';
import { formatNumber, formatRate, formatTime } from './format';

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
