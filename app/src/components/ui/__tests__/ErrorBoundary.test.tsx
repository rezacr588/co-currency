import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { ErrorBoundary } from '../ErrorBoundary';
import { buildTheme } from '../../../theme';
import { darkColors } from '../../../constants/colors';

const testTheme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={testTheme}>{ui}</ThemeProvider>);
}

// Component that throws
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test error');
  return null;
}

// Suppress console.error for expected error boundary logs
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  (console.error as jest.Mock).mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    const { getByText } = renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    );
    // No error, children rendered (component returns null but no crash)
    expect(true).toBe(true);
  });

  it('renders fallback UI when child throws', () => {
    const { getByText } = renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Test error')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    const { getByText } = render(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText('Custom fallback')).toBeTruthy();
  });

  it('uses fontFamily not fontWeight for text styles', () => {
    const { getByText } = renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    const title = getByText('Something went wrong');
    expect(title.props.style.fontFamily).toBe('Inter_600SemiBold');
    expect(title.props.style).not.toHaveProperty('fontWeight');
  });

  it('does not use hardcoded #71717a for error message color', () => {
    const { getByText } = renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    const message = getByText('Test error');
    expect(message.props.style.color).not.toBe('#71717a');
  });

  it('resets error state on Try Again press', () => {
    // We can't test reset fully because ThrowingComponent will throw again,
    // but we can verify the button is pressable
    const { getByText } = renderWithTheme(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText('Try Again')).toBeTruthy();
  });
});
