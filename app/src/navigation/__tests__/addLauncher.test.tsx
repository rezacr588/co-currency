import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import AddTransactionLauncherScreen from '../../../app/(app)/(tabs)/add';
import { darkColors } from '../../constants/colors';
import { buildTheme } from '../../theme';

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const theme = buildTheme(darkColors, true);

function renderScreen() {
  return render(
    <ThemeProvider theme={theme}>
      <AddTransactionLauncherScreen />
    </ThemeProvider>
  );
}

describe('AddTransactionLauncherScreen', () => {
  beforeEach(() => {
    mockUseLocalSearchParams.mockReturnValue({
      amount: '18',
      category: 'food',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('forwards params and injects the default finapp return target', async () => {
    renderScreen();

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/transaction-create',
        params: {
          amount: '18',
          category: 'food',
          return_to: encodeURIComponent('/finapp'),
        },
      });
    });
  });
});
