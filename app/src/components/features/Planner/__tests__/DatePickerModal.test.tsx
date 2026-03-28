import React from 'react';
import { Platform, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { DatePickerModal } from '../DatePickerModal';

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined }),
}));

jest.mock('../../../../utils/haptics', () => ({
  haptics: {
    success: jest.fn(),
    light: jest.fn(),
    selection: jest.fn(),
  },
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { Text } = require('react-native');

  const MockPicker = () => <Text>native-picker</Text>;

  return {
    __esModule: true,
    default: MockPicker,
    DateTimePickerAndroid: {
      open: jest.fn(),
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const theme = buildTheme(darkColors, true);
const originalPlatform = Platform.OS;

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('DatePickerModal', () => {
  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'web',
    });
  });

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: originalPlatform,
    });
  });

  it('resyncs the visible date when initialDate changes', () => {
    const view = renderWithTheme(
      <DatePickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        initialDate="2026-03-01"
      />
    );

    expect(view.getByText('2026-03-01')).toBeTruthy();

    view.rerender(
      <ThemeProvider theme={theme}>
        <DatePickerModal
          visible
          onClose={jest.fn()}
          onSelect={jest.fn()}
          initialDate="2026-04-09"
        />
      </ThemeProvider>
    );

    expect(view.getByText('2026-04-09')).toBeTruthy();
  });
});
