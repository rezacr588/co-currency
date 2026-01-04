import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Language, TranslationKey } from '../i18n/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const IRAN_COUNTRY_CODE = 'IR';
const STORAGE_KEY = 'currency-converter-language';

async function detectIranIP(): Promise<boolean> {
  try {
    const response = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.country_code === IRAN_COUNTRY_CODE;
  } catch {
    return false;
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function initLanguage() {
      // Check localStorage first
      const savedLanguage = localStorage.getItem(STORAGE_KEY) as Language | null;

      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'fa')) {
        setLanguageState(savedLanguage);
        setIsInitialized(true);
        return;
      }

      // If no saved preference, check if user is from Iran
      const isFromIran = await detectIranIP();
      if (isFromIran) {
        setLanguageState('fa');
        localStorage.setItem(STORAGE_KEY, 'fa');
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

  const isRTL = language === 'fa';

  // Update document direction
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [isRTL, language]);

  if (!isInitialized) {
    return null; // Or a loading spinner
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
