import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'currency-converter-language';

// RTL languages
const RTL_LANGUAGES: Language[] = ['fa', 'ar'];

// Browser locale to language mapping
const LOCALE_LANGUAGE_MAP: Record<string, Language> = {
  fa: 'fa',
  'fa-IR': 'fa',
  ar: 'ar',
  'ar-SA': 'ar',
  'ar-AE': 'ar',
  'ar-EG': 'ar',
  tr: 'tr',
  'tr-TR': 'tr',
  en: 'en',
  'en-US': 'en',
  'en-GB': 'en',
};

// Country to language mapping (fallback from IP)
const COUNTRY_LANGUAGE_MAP: Record<string, Language> = {
  IR: 'fa', // Iran
  SA: 'ar', // Saudi Arabia
  AE: 'ar', // UAE
  EG: 'ar', // Egypt
  TR: 'tr', // Turkey
};

/**
 * Detect language from browser locale
 */
function detectBrowserLanguage(): Language | null {
  try {
    // Check navigator.language and navigator.languages
    const browserLocales = [
      navigator.language,
      ...(navigator.languages || [])
    ];

    for (const locale of browserLocales) {
      // Try exact match first (e.g., "fa-IR")
      if (locale in LOCALE_LANGUAGE_MAP) {
        return LOCALE_LANGUAGE_MAP[locale];
      }

      // Try language code only (e.g., "fa" from "fa-IR")
      const langCode = locale.split('-')[0];
      if (langCode in LOCALE_LANGUAGE_MAP) {
        return LOCALE_LANGUAGE_MAP[langCode];
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect language from user's country via IP lookup
 */
async function detectCountry(): Promise<string | null> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.country_code || null;
  } catch {
    return null;
  }
}

const VALID_LANGUAGES: Language[] = ['en', 'fa', 'ar', 'tr'];

function isValidLanguage(lang: string | null): lang is Language {
  return lang !== null && VALID_LANGUAGES.includes(lang as Language);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initLanguage() {
      // Priority 1: Check localStorage for saved preference
      const savedLanguage = localStorage.getItem(STORAGE_KEY);
      if (isValidLanguage(savedLanguage)) {
        setLanguageState(savedLanguage);
        setIsInitialized(true);
        return;
      }

      // Priority 2: Check URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const langParam = urlParams.get('lang');
      if (isValidLanguage(langParam)) {
        setLanguageState(langParam);
        localStorage.setItem(STORAGE_KEY, langParam);
        setIsInitialized(true);
        return;
      }

      // Priority 3: Detect from browser locale (instant, no API call)
      const browserLang = detectBrowserLanguage();
      if (browserLang) {
        setLanguageState(browserLang);
        // Don't save to localStorage - let user explicitly choose to persist
        setIsInitialized(true);
        return;
      }

      // Priority 4: Detect from user's country via IP (fallback, requires API call)
      const countryCode = await detectCountry();
      if (countryCode && countryCode in COUNTRY_LANGUAGE_MAP) {
        const detectedLang = COUNTRY_LANGUAGE_MAP[countryCode];
        setLanguageState(detectedLang);
        // Don't save to localStorage - let user explicitly choose to persist
      }

      setIsInitialized(true);
    }

    initLanguage();
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: TranslationKey): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  const isRTL = RTL_LANGUAGES.includes(language);

  // Update document direction and lang
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  if (!isInitialized) {
    return null;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
