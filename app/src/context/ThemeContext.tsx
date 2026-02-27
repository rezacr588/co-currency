import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { readStorage, writeStorage } from '../utils/storage';
import { darkColors, lightColors, type ColorPalette } from '../constants/colors';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'cofinance-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isInitialized, setIsInitialized] = useState(false);

  // Load theme from storage on mount, follow system if no stored preference
  useEffect(() => {
    async function loadTheme() {
      const stored = await readStorage(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      } else if (systemColorScheme) {
        setThemeState(systemColorScheme);
      }
      setIsInitialized(true);
    }
    loadTheme();
  }, [systemColorScheme]);

  // Save theme to storage when it changes
  useEffect(() => {
    if (isInitialized) {
      writeStorage(THEME_STORAGE_KEY, theme);
    }
  }, [theme, isInitialized]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const isDark = theme === 'dark';
  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/** Convenience hook to get the current theme colors */
export function useColors(): ColorPalette {
  const { colors } = useTheme();
  return colors;
}
