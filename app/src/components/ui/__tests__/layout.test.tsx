import React from 'react';
import * as ReactNative from 'react-native';
import { ScrollView, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from 'styled-components/native';
import { darkColors } from '../../../constants/colors';
import { buildTheme } from '../../../theme';
import { PageHeader, PageScaffold } from '../layout';

const mockedUseWindowDimensions = jest.spyOn(ReactNative, 'useWindowDimensions');
const theme = buildTheme(darkColors, true);

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

function flattenStyle(style: any) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean));
  }
  return style || {};
}

describe('layout scaffolds', () => {
  beforeEach(() => {
    mockedUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 800,
      scale: 1,
      fontScale: 1,
    });
  });

  it('uses layout tokens for narrow page scaffolds', () => {
    const { UNSAFE_getByType } = renderWithTheme(
      <PageScaffold narrow>
        <View />
      </PageScaffold>
    );

    const scrollView = UNSAFE_getByType(ScrollView);
    const contentStyles = flattenStyle(scrollView.props.contentContainerStyle);

    expect(contentStyles.maxWidth).toBe(theme.layout.maxReadingWidth);
    expect(contentStyles.paddingHorizontal).toBe(theme.layout.pageGutter.mobile);
    expect(contentStyles.paddingTop).toBe(theme.spacing.lg);
  });

  it('renders a page header snapshot with subtitle and actions', () => {
    const view = renderWithTheme(
      <PageHeader
        title="Dashboard"
        subtitle="Review balances and reports"
        actions={<View testID="header-action" />}
      />
    );

    expect(view.getByText('Dashboard')).toBeTruthy();
    expect(view.getByText('Review balances and reports')).toBeTruthy();
    expect(view.getByTestId('header-action')).toBeTruthy();
    expect(view.toJSON()).toMatchSnapshot();
  });

  it('exposes standardized layout tokens in the theme', () => {
    expect(theme.layout.pageGutter.mobile).toBe(16);
    expect(theme.layout.pageGutter.desktop).toBe(32);
    expect(theme.layout.maxContentWidth).toBe(1120);
    expect(theme.layout.maxReadingWidth).toBe(720);
    expect(theme.layout.navRailWidth.expanded).toBe(240);
    expect(theme.layout.navRailWidth.collapsed).toBe(72);
    expect(theme.layout.headerHeight).toBe(64);
  });
});
