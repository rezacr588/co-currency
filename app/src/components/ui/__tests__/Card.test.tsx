import React from 'react';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { Card } from '../Card';
import { StyledCard } from '../styled/StyledCard';
import { darkColors } from '../../../constants/colors';
import { buildTheme } from '../../../theme';

const darkTheme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={darkTheme}>{ui}</ThemeProvider>);
}

function flattenStyle(style: any) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean));
  }
  return style || {};
}

describe('Card', () => {
  it('uses tokenized default surface styles', () => {
    const { getByTestId } = renderWithTheme(<Card testID="card">Body</Card>);
    const card = getByTestId('card');
    const styles = flattenStyle(card.props.style);

    expect(styles.backgroundColor).toBe(darkColors.card);
    expect(styles.borderWidth).toBe(1);
    expect(styles.borderColor).toBe(darkColors.borderSubtle);
    expect(styles.borderRadius).toBe(darkTheme.radii.xl);
    expect(styles.padding).toBe(darkTheme.spacing.lg);
    expect(styles.shadowColor).toBe('#000');
  });

  it('keeps StyledCard aligned with Card defaults', () => {
    const { getByTestId } = renderWithTheme(<StyledCard testID="styled-card">Body</StyledCard>);
    const card = getByTestId('styled-card');
    const styles = flattenStyle(card.props.style);

    expect(styles.backgroundColor).toBe(darkColors.card);
    expect(styles.borderColor).toBe(darkColors.borderSubtle);
    expect(styles.borderRadius).toBe(darkTheme.radii.xl);
    expect(styles.padding).toBe(darkTheme.spacing.lg);
  });
});
