import {
  COMPACT_PHONE_MAX_WIDTH,
  DESKTOP_MIN_WIDTH,
  TABLET_MIN_WIDTH,
  getScreenLayout,
} from '../screenLayout';

describe('getScreenLayout', () => {
  it('flags compact phones below tablet width', () => {
    const layout = getScreenLayout(COMPACT_PHONE_MAX_WIDTH);

    expect(layout.isCompactPhone).toBe(true);
    expect(layout.isPhone).toBe(true);
    expect(layout.isTablet).toBe(false);
    expect(layout.isDesktop).toBe(false);
  });

  it('treats regular phones as non-compact phone screens', () => {
    const layout = getScreenLayout(COMPACT_PHONE_MAX_WIDTH + 1);

    expect(layout.isCompactPhone).toBe(false);
    expect(layout.isPhone).toBe(true);
    expect(layout.isTablet).toBe(false);
    expect(layout.isDesktop).toBe(false);
  });

  it('treats tablet widths as tablet-only', () => {
    const layout = getScreenLayout(TABLET_MIN_WIDTH);

    expect(layout.isCompactPhone).toBe(false);
    expect(layout.isPhone).toBe(false);
    expect(layout.isTablet).toBe(true);
    expect(layout.isDesktop).toBe(false);
  });

  it('treats desktop widths as desktop-only', () => {
    const layout = getScreenLayout(DESKTOP_MIN_WIDTH);

    expect(layout.isCompactPhone).toBe(false);
    expect(layout.isPhone).toBe(false);
    expect(layout.isTablet).toBe(false);
    expect(layout.isDesktop).toBe(true);
  });
});
