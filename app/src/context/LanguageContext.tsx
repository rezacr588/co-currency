import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { I18nManager, Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import { translations, Language } from '../i18n/translations';
import { readStorage, writeStorage } from '../utils/storage';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'currency-converter-language';

// RTL languages
const RTL_LANGUAGES: Language[] = ['fa', 'ar'];

// Locale to language mapping
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

const VALID_LANGUAGES: Language[] = ['en', 'fa', 'ar', 'tr'];

function isValidLanguage(lang: string | null): lang is Language {
  return lang !== null && VALID_LANGUAGES.includes(lang as Language);
}

/**
 * Detect language from device locale
 */
function detectDeviceLanguage(): Language | null {
  try {
    const locales = getLocales();
    if (locales.length === 0) return null;

    for (const locale of locales) {
      const tag = locale.languageTag;
      const code = locale.languageCode;

      // Try exact match first (e.g., "fa-IR")
      if (tag && tag in LOCALE_LANGUAGE_MAP) {
        return LOCALE_LANGUAGE_MAP[tag];
      }

      // Try language code only (e.g., "fa")
      if (code && code in LOCALE_LANGUAGE_MAP) {
        return LOCALE_LANGUAGE_MAP[code];
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initLanguage() {
      // Priority 1: Check storage for saved preference
      const savedLanguage = await readStorage(STORAGE_KEY);
      if (isValidLanguage(savedLanguage)) {
        setLanguageState(savedLanguage);
        setIsInitialized(true);
        return;
      }

      // Priority 2: Detect from device locale
      const deviceLang = detectDeviceLanguage();
      if (deviceLang) {
        setLanguageState(deviceLang);
        setIsInitialized(true);
        return;
      }

      // Default to English
      setIsInitialized(true);
    }

    initLanguage();
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await writeStorage(STORAGE_KEY, lang);

    // Handle RTL change (requires app restart on native)
    const shouldBeRTL = RTL_LANGUAGES.includes(lang);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = shouldBeRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      // Note: On native, RTL changes require app restart to take effect
    }
  };

  const t = (key: string): string => {
    const langTranslations = translations[language] as Record<string, string>;
    const enTranslations = translations.en as Record<string, string>;
    return langTranslations[key] || enTranslations[key] || key;
  };

  const isRTL = RTL_LANGUAGES.includes(language);

  // Update RTL on initial load
  useEffect(() => {
    if (!isInitialized) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.forceRTL(isRTL);
    }
  }, [isInitialized, isRTL, language]);

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
