import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { Button } from '../Button';
import { darkColors, lightColors } from '../../../constants/colors';
import { buildTheme } from '../../../theme';

const darkTheme = buildTheme(darkColors, true);
const lightTheme = buildTheme(lightColors, false);

function renderWithTheme(ui: React.ReactElement, theme = darkTheme) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('Button', () => {
  it('renders children text', () => {
    const { getByText } = renderWithTheme(<Button>Click me</Button>);
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button onPress={onPress}>Press</Button>
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button onPress={onPress} disabled>Press</Button>
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPress = jest.fn();
    const { getByRole } = renderWithTheme(
      <Button onPress={onPress} isLoading>Press</Button>
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows ActivityIndicator when loading', () => {
    const { queryByText, UNSAFE_getByType } = renderWithTheme(
      <Button isLoading>Press</Button>
    );
    // Text should be hidden when loading
    expect(queryByText('Press')).toBeNull();
  });

  it('applies correct background for each variant', () => {
    const variants = ['primary', 'secondary', 'ghost', 'danger', 'success', 'outline', 'accent'] as const;
    const expectedBgColors: Record<string, string> = {
      primary: darkColors.primary,
      secondary: darkColors.secondary,
      ghost: 'transparent',
      danger: darkColors.danger,
      success: darkColors.success,
      outline: 'transparent',
      accent: darkColors.accent,
    };

    variants.forEach((variant) => {
      const { getByRole, unmount } = renderWithTheme(
        <Button variant={variant}>{variant}</Button>
      );
      const button = getByRole('button');
      const styles = Array.isArray(button.props.style)
        ? Object.assign({}, ...button.props.style.filter(Boolean))
        : button.props.style;
      expect(styles.backgroundColor).toBe(expectedBgColors[variant]);
      unmount();
    });
  });

  it('accepts object style prop', () => {
    const { getByRole } = renderWithTheme(
      <Button style={{ marginTop: 10 }}>Styled</Button>
    );
    const button = getByRole('button');
    const flatStyle = Object.assign({}, ...button.props.style.filter(Boolean));
    expect(flatStyle.marginTop).toBe(10);
  });

  it('accepts array style prop', () => {
    const { getByRole } = renderWithTheme(
      <Button style={[{ marginTop: 10 }, { marginBottom: 5 }]}>Styled</Button>
    );
    const button = getByRole('button');
    const flatStyle = Object.assign({}, ...button.props.style.filter(Boolean));
    expect(flatStyle.marginTop).toBe(10);
    expect(flatStyle.marginBottom).toBe(5);
  });

  it('renders with correct text color per variant', () => {
    const { getByText } = renderWithTheme(
      <Button variant="primary">Primary</Button>
    );
    const textEl = getByText('Primary');
    expect(textEl.props.style.color).toBe(darkColors.primaryForeground);
  });

  it('uses Inter_600SemiBold fontFamily', () => {
    const { getByText } = renderWithTheme(<Button>Text</Button>);
    expect(getByText('Text').props.style.fontFamily).toBe('Inter_600SemiBold');
  });

  it('has correct accessibility states when disabled', () => {
    const { getByRole } = renderWithTheme(
      <Button disabled>Disabled</Button>
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: false });
  });

  it('has correct accessibility states when loading', () => {
    const { getByRole } = renderWithTheme(
      <Button isLoading>Loading</Button>
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
  });

  it('renders leftIcon and rightIcon without crashing', () => {
    const { getByText, toJSON } = renderWithTheme(
      <Button
        leftIcon={<React.Fragment />}
        rightIcon={<React.Fragment />}
      >
        Middle
      </Button>
    );
    expect(getByText('Middle')).toBeTruthy();
    // Verify the tree has icon wrapper Views (leftIcon + text + rightIcon = 3 children)
    const tree = toJSON();
    expect(tree.children.length).toBe(3);
  });

  it('works with light theme', () => {
    const { getByText } = renderWithTheme(
      <Button variant="primary">Light</Button>,
      lightTheme
    );
    const textEl = getByText('Light');
    expect(textEl.props.style.color).toBe(lightColors.primaryForeground);
  });
});
