import { describe, it, expect } from 'vitest';
import { CURRENCY_FLAGS, CURRENCY_SYMBOLS, POPULAR_CURRENCIES } from './constants';

describe('CURRENCY_FLAGS', () => {
  it('should have flags for popular currencies', () => {
    POPULAR_CURRENCIES.forEach(currency => {
      expect(CURRENCY_FLAGS[currency]).toBeTruthy();
    });
  });

  it('should have emoji flags', () => {
    Object.values(CURRENCY_FLAGS).forEach(flag => {
      expect(flag.length).toBeGreaterThan(0);
    });
  });

  it('should have flags for common currencies', () => {
    const commonCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD'];
    commonCurrencies.forEach(currency => {
      expect(CURRENCY_FLAGS[currency]).toBeTruthy();
    });
  });

  it('should have flags for Arabic region currencies', () => {
    const arabicCurrencies = ['SAR', 'AED'];
    arabicCurrencies.forEach(currency => {
      expect(CURRENCY_FLAGS[currency]).toBeTruthy();
    });
  });

  it('should have flag for Turkish Lira', () => {
    expect(CURRENCY_FLAGS.TRY).toBe('🇹🇷');
  });
});

describe('CURRENCY_SYMBOLS', () => {
  it('should have correct symbols for major currencies', () => {
    expect(CURRENCY_SYMBOLS.USD).toBe('$');
    expect(CURRENCY_SYMBOLS.EUR).toBe('€');
    expect(CURRENCY_SYMBOLS.GBP).toBe('£');
    expect(CURRENCY_SYMBOLS.JPY).toBe('¥');
  });

  it('should have symbols for all popular currencies', () => {
    POPULAR_CURRENCIES.forEach(currency => {
      expect(CURRENCY_SYMBOLS[currency]).toBeTruthy();
    });
  });
});

describe('POPULAR_CURRENCIES', () => {
  it('should contain major world currencies', () => {
    expect(POPULAR_CURRENCIES).toContain('USD');
    expect(POPULAR_CURRENCIES).toContain('EUR');
    expect(POPULAR_CURRENCIES).toContain('GBP');
  });

  it('should contain IRR for Persian users', () => {
    expect(POPULAR_CURRENCIES).toContain('IRR');
  });

  it('should be an array of strings', () => {
    expect(Array.isArray(POPULAR_CURRENCIES)).toBe(true);
    POPULAR_CURRENCIES.forEach(currency => {
      expect(typeof currency).toBe('string');
      expect(currency.length).toBe(3);
    });
  });
});
