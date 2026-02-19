import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { FormError } from '../FormError';
import { darkColors } from '../../../constants/colors';
import { buildTheme } from '../../../theme';

const theme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('FormError', () => {
  it('renders nothing when message is empty', () => {
    const { toJSON } = renderWithTheme(<FormError message="" />);
    expect(toJSON()).toBeNull();
  });

  it('renders error message when provided', () => {
    const { getByText } = renderWithTheme(<FormError message="Invalid input" />);
    expect(getByText('Invalid input')).toBeTruthy();
  });

  it('uses danger color for text', () => {
    const { getByText } = renderWithTheme(<FormError message="Error" />);
    expect(getByText('Error').props.style.color).toBe(darkColors.danger);
  });

  it('uses dangerMuted for background', () => {
    const { toJSON } = renderWithTheme(<FormError message="Error" />);
    const root = toJSON();
    expect(root.props.style.backgroundColor).toBe(darkColors.dangerMuted);
  });
});
