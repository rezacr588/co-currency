import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { useQuery } from '@tanstack/react-query';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { WeeklyReportView } from '../WeeklyReportView';

const mockRefetch = jest.fn().mockResolvedValue({});

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    t: (key: string) => {
      const labels: Record<string, string> = {
        failedToLoadReport: 'Failed to load report',
        checkConnection: 'Please check your connection and try again.',
        retry: 'Retry',
      };
      return labels[key] || key;
    },
  }),
}));

jest.mock('../../../../hooks/useReportTimeZone', () => ({
  useReportTimeZone: () => ({
    reportTimeZone: 'Europe/Istanbul',
  }),
}));

const theme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('ReportErrorCard retry wiring', () => {
  beforeEach(() => {
    mockRefetch.mockClear();
    (useQuery as jest.Mock).mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: mockRefetch,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('calls refetch when retry is pressed in weekly report error state', async () => {
    const screen = renderWithTheme(<WeeklyReportView />);
    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });
});
