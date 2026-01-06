import { describe, it, expect } from 'vitest';
import { translations, Language, TranslationKey } from './translations';

const languages: Language[] = ['en', 'fa', 'ar', 'tr'];

describe('translations', () => {
  it('should have all required languages', () => {
    expect(Object.keys(translations)).toEqual(expect.arrayContaining(['en', 'fa', 'ar', 'tr']));
  });

  it('should have the same keys in all languages', () => {
    const englishKeys = Object.keys(translations.en) as TranslationKey[];

    languages.forEach(lang => {
      const langKeys = Object.keys(translations[lang]);
      expect(langKeys).toEqual(expect.arrayContaining(englishKeys));
      expect(langKeys.length).toBe(englishKeys.length);
    });
  });

  it('should not have empty strings for any translation', () => {
    languages.forEach(lang => {
      Object.entries(translations[lang]).forEach(([key, value]) => {
        expect(value).toBeTruthy();
        expect(value.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('should have RTL-appropriate content for fa and ar', () => {
    // Persian
    expect(translations.fa.appTitle).toMatch(/[\u0600-\u06FF]/);
    // Arabic
    expect(translations.ar.appTitle).toMatch(/[\u0600-\u06FF]/);
  });

  it('should have Turkish content for tr', () => {
    expect(translations.tr.appTitle).toBe('Döviz Çevirici');
  });

  it('should have core converter keys', () => {
    const coreKeys: TranslationKey[] = [
      'appTitle',
      'converterTitle',
      'amount',
      'from',
      'to',
      'searchCurrency',
      'swapCurrencies',
    ];

    coreKeys.forEach(key => {
      languages.forEach(lang => {
        expect(translations[lang][key]).toBeTruthy();
      });
    });
  });
});
