import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../../constants/colors';
import { buildTheme } from '../../../../theme';
import { DateRangeSelector } from '../DateRangeSelector';

jest.mock('../../../../hooks/useScreenLayout', () => ({
  useScreenLayout: () => ({
    width: 390,
    height: 844,
    isCompactPhone: false,
    isPhone: true,
    isTablet: false,
    isDesktop: false,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const theme = buildTheme(darkColors, true);

const t = (key: string) => {
  const labels: Record<string, string> = {
    thisMonth: 'This Month',
    lastMonth: 'Last Month',
    threeMonths: '3 Months',
    sixMonths: '6 Months',
    thisYear: 'This Year',
    lastYear: 'Last Year',
    close: 'Close',
    selectMonth: 'Select Month',
  };
  return labels[key] || key;
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('DateRangeSelector', () => {
  it('changes preset when a preset pill is pressed', () => {
    const onPresetChange = jest.fn();

    const screen = renderWithTheme(
      <DateRangeSelector
        selectedPreset="this_month"
        onPresetChange={onPresetChange}
        selectedYear={2026}
        selectedMonth={3}
        onMonthSelect={jest.fn()}
        dateLabel="March 2026"
        monthLabels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
        selectDateRangeLabel="Select date range"
        previousYearLabel="Previous year"
        nextYearLabel="Next year"
        t={t}
        currentYear={2026}
        currentMonth={3}
      />
    );

    fireEvent.press(screen.getByText('3 Months'));
    expect(onPresetChange).toHaveBeenCalledWith('last_3_months');
  });

  it('opens month picker and selects a month', () => {
    const onMonthSelect = jest.fn();

    const screen = renderWithTheme(
      <DateRangeSelector
        selectedPreset="custom"
        onPresetChange={jest.fn()}
        selectedYear={2026}
        selectedMonth={3}
        onMonthSelect={onMonthSelect}
        dateLabel="March 2026"
        monthLabels={['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']}
        selectDateRangeLabel="Select date range"
        previousYearLabel="Previous year"
        nextYearLabel="Next year"
        t={t}
        currentYear={2026}
        currentMonth={3}
      />
    );

    fireEvent.press(screen.getByLabelText('Select Month: March 2026'));
    fireEvent.press(screen.getByText('Feb'));
    expect(onMonthSelect).toHaveBeenCalledWith(2026, 2);
  });
});
