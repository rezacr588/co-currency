import { darkColors, lightColors, ColorPalette } from '../colors';

describe('Color Palette', () => {
  const requiredKeys: (keyof ColorPalette)[] = [
    'background', 'backgroundSecondary', 'card', 'cardHover', 'cardElevated',
    'foreground', 'mutedForeground', 'subtleForeground',
    'primary', 'primaryHover', 'primaryForeground',
    'secondary', 'secondaryHover', 'secondaryForeground',
    'accent', 'accentHover', 'accentMuted', 'accentForeground',
    'muted',
    'success', 'successMuted', 'danger', 'dangerMuted', 'warning', 'warningMuted', 'info', 'infoMuted',
    'border', 'borderSubtle', 'borderStrong',
    'input', 'placeholder', 'ring',
    'tabBarBackground', 'tabBarActive', 'tabBarInactive', 'tabBarBorder',
    'chatBubbleUser', 'chatBubbleBot',
    'overlay',
  ];

  it('dark theme has all required color keys', () => {
    requiredKeys.forEach((key) => {
      expect(darkColors).toHaveProperty(key);
      expect(typeof darkColors[key]).toBe('string');
    });
  });

  it('light theme has all required color keys', () => {
    requiredKeys.forEach((key) => {
      expect(lightColors).toHaveProperty(key);
      expect(typeof lightColors[key]).toBe('string');
    });
  });

  it('dark and light themes have the same keys', () => {
    const darkKeys = Object.keys(darkColors).sort();
    const lightKeys = Object.keys(lightColors).sort();
    expect(darkKeys).toEqual(lightKeys);
  });

  it('dark mutedForeground matches expected value', () => {
    expect(darkColors.mutedForeground).toBe('#a1a1aa');
  });

  it('light mutedForeground differs from dark', () => {
    expect(lightColors.mutedForeground).not.toBe(darkColors.mutedForeground);
  });

  it('accent color is gold-ish', () => {
    expect(darkColors.accent).toBe('#c8a94b');
  });

  it('no color value is empty string', () => {
    const assertNoEmpty = (obj: Record<string, unknown>) => {
      Object.entries(obj).forEach(([, value]) => {
        if (typeof value === 'string') {
          expect(value.length).toBeGreaterThan(0);
        } else if (value && typeof value === 'object') {
          assertNoEmpty(value as Record<string, unknown>);
        }
      });
    };
    assertNoEmpty(darkColors as unknown as Record<string, unknown>);
    assertNoEmpty(lightColors as unknown as Record<string, unknown>);
  });

  it('palette group exists with core hues in both themes', () => {
    const hues = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'teal', 'lime', 'cyan', 'gray'] as const;
    hues.forEach((hue) => {
      expect(darkColors.palette[hue]).toBeTruthy();
      expect(darkColors.palette[`${hue}Muted` as const]).toBeTruthy();
      expect(lightColors.palette[hue]).toBeTruthy();
      expect(lightColors.palette[`${hue}Muted` as const]).toBeTruthy();
    });
  });
});
