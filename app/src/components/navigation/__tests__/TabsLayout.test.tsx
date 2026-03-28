import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../constants/colors';
import { buildTheme } from '../../../theme';
import TabsLayout from '../../../../app/(app)/(tabs)/_layout';

const screenCalls: Array<{ name: string; options?: Record<string, unknown> }> = [];

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Tabs = ({ children }: { children: React.ReactNode }) => <View>{children}</View>;
  Tabs.Screen = ({ name, options }: { name: string; options?: Record<string, unknown> }) => {
    screenCalls.push({ name, options });
    return null;
  };

  return {
    Tabs,
    usePathname: () => '/(app)/(tabs)',
    useRouter: () => ({ push: jest.fn() }),
  };
});

jest.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    isDark: true,
    toggleTheme: jest.fn(),
  }),
}));

jest.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        walletTabCompact: 'Wallet',
        plannerTabCompact: 'Planner',
        addTabCompact: 'Add',
        settings: 'Settings',
      };

      return labels[key];
    },
  }),
}));

jest.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { name: 'Rez', email: 'rez@example.com' },
    logout: jest.fn(),
  }),
}));

jest.mock('../../../components/navigation/AppSwitcherTrigger', () => ({
  AppSwitcherTrigger: () => null,
}));

jest.mock('../../../components/ui/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../../hooks/useScreenLayout', () => ({
  useScreenLayout: () => ({
    isCompactPhone: false,
    isDesktop: false,
    isTablet: false,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const theme = buildTheme(darkColors, true);

describe('TabsLayout', () => {
  beforeEach(() => {
    screenCalls.length = 0;
  });

  it('renders the mobile tab order as wallet, planner, add, settings', () => {
    render(
      <ThemeProvider theme={theme}>
        <TabsLayout />
      </ThemeProvider>
    );

    const visibleScreens = screenCalls
      .filter((call) => call.options?.href !== null)
      .map((call) => call.name);

    expect(visibleScreens).toEqual(['index', 'planner', 'add', 'settings']);
  });
});
