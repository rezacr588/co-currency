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

// Country to language mapping
const COUNTRY_LANGUAGE_MAP: Record<string, Language> = {
  IR: 'fa', // Iran
  SA: 'ar', // Saudi Arabia
  AE: 'ar', // UAE
  EG: 'ar', // Egypt
  TR: 'tr', // Turkey
};

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
      // Check localStorage first
      const savedLanguage = localStorage.getItem(STORAGE_KEY);

      if (isValidLanguage(savedLanguage)) {
        setLanguageState(savedLanguage);
        setIsInitialized(true);
        return;
      }

      // Check URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const langParam = urlParams.get('lang');
      if (isValidLanguage(langParam)) {
        setLanguageState(langParam);
        localStorage.setItem(STORAGE_KEY, langParam);
        setIsInitialized(true);
        return;
      }

      // If no saved preference, check user's country
      const countryCode = await detectCountry();
      if (countryCode && countryCode in COUNTRY_LANGUAGE_MAP) {
        const detectedLang = COUNTRY_LANGUAGE_MAP[countryCode];
        setLanguageState(detectedLang);
        localStorage.setItem(STORAGE_KEY, detectedLang);
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
