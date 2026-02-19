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
    expect(darkColors.mutedForeground).toBe('#71717a');
  });

  it('light mutedForeground differs from dark', () => {
    expect(lightColors.mutedForeground).not.toBe(darkColors.mutedForeground);
  });

  it('accent color is gold-ish', () => {
    expect(darkColors.accent).toBe('#d4af37');
  });

  it('no color value is empty string', () => {
    Object.entries(darkColors).forEach(([key, value]) => {
      expect(value.length).toBeGreaterThan(0);
    });
    Object.entries(lightColors).forEach(([key, value]) => {
      expect(value.length).toBeGreaterThan(0);
    });
  });
});
