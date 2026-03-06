import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { ReportPeriodTabs } from '../ReportPeriodTabs';

jest.mock('../../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        dailyReport: 'Daily',
        weeklyReport: 'Weekly',
        monthlyReport: 'Monthly',
        yearlyReport: 'Yearly',
        allTime: 'All Time',
      };

      return labels[key] || key;
    },
  }),
}));

const theme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('ReportPeriodTabs', () => {
  it('renders and selects the all-time tab', () => {
    const onSelect = jest.fn();
    const { getByText } = renderWithTheme(
      <ReportPeriodTabs selected="monthly" onSelect={onSelect} />
    );

    fireEvent.press(getByText('All Time'));

    expect(onSelect).toHaveBeenCalledWith('all_time');
  });
});
