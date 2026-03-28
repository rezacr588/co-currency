import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../constants/colors';
import { buildTheme } from '../../../theme';
import { MultiStepWizardScreen } from '../MultiStepWizardScreen';

jest.mock('../../../hooks/useScreenLayout', () => ({
  useScreenLayout: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const theme = buildTheme(darkColors, true);
const mockUseScreenLayout = jest.requireMock('../../../hooks/useScreenLayout').useScreenLayout as jest.Mock;

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function flattenStyle(style: any) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean));
  }
  return style || {};
}

describe('MultiStepWizardScreen', () => {
  const steps = [
    { key: 'basics', label: 'Basics', shortLabel: 'Basics' },
    { key: 'currency', label: 'Currency', shortLabel: 'Currency' },
    { key: 'review', label: 'Review', shortLabel: 'Review' },
  ];

  beforeEach(() => {
    mockUseScreenLayout.mockReturnValue({
      width: 1280,
      height: 800,
      isCompactPhone: false,
      isPhone: false,
      isTablet: false,
      isDesktop: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders desktop step states and fires shell actions', () => {
    const onClose = jest.fn();
    const onDiscard = jest.fn();
    const onBack = jest.fn();
    const onPrimaryAction = jest.fn();
    const onStepPress = jest.fn();

    const view = renderWithTheme(
      <MultiStepWizardScreen
        eyebrow="Wizard"
        title="Currency"
        steps={steps}
        activeStep="currency"
        onStepPress={onStepPress}
        onClose={onClose}
        onDiscard={onDiscard}
        onBack={onBack}
        onPrimaryAction={onPrimaryAction}
        primaryLabel="Next"
      >
        <></>
      </MultiStepWizardScreen>
    );

    expect(view.getByText('Wizard')).toBeTruthy();
    expect(view.getAllByText('Currency').length).toBeGreaterThan(0);

    const completedStyles = flattenStyle(view.getByTestId('wizard-step-card-basics').props.style);
    const activeStyles = flattenStyle(view.getByTestId('wizard-step-card-currency').props.style);

    expect(completedStyles.backgroundColor).toBe(theme.colors.success + '20');
    expect(activeStyles.backgroundColor).toBe(theme.colors.foreground);

    fireEvent.press(view.getByTestId('wizard-close-action'));
    fireEvent.press(view.getByTestId('wizard-discard-action'));
    fireEvent.press(view.getByTestId('wizard-back-action'));
    fireEvent.press(view.getByTestId('wizard-primary-action'));
    fireEvent.press(view.getByTestId('wizard-step-currency'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
    expect(onStepPress).toHaveBeenCalledWith('currency');
  });

  it('renders the mobile stepper variant with short labels', () => {
    mockUseScreenLayout.mockReturnValue({
      width: 390,
      height: 844,
      isCompactPhone: false,
      isPhone: true,
      isTablet: false,
      isDesktop: false,
    });

    const view = renderWithTheme(
      <MultiStepWizardScreen
        eyebrow="Wizard"
        title="Basics"
        steps={steps}
        activeStep="basics"
        onStepPress={jest.fn()}
        onClose={jest.fn()}
        onDiscard={jest.fn()}
        onBack={jest.fn()}
        onPrimaryAction={jest.fn()}
        primaryLabel="Next"
      >
        <></>
      </MultiStepWizardScreen>
    );

    const activeStyles = flattenStyle(view.getByTestId('wizard-step-card-basics').props.style);
    const pendingStyles = flattenStyle(view.getByTestId('wizard-step-card-review').props.style);

    expect(activeStyles.backgroundColor).toBe(theme.colors.foreground);
    expect(pendingStyles.backgroundColor).toBe(theme.colors.background + 'E8');
    expect(view.getByText('Wizard')).toBeTruthy();
    expect(view.getAllByText('Basics').length).toBeGreaterThan(0);
    expect(view.getByText('Review')).toBeTruthy();
  });
});
