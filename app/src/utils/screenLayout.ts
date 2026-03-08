export const COMPACT_PHONE_MAX_WIDTH = 359;
export const TABLET_MIN_WIDTH = 768;
export const DESKTOP_MIN_WIDTH = 1024;

export interface ScreenLayoutState {
  width: number;
  isCompactPhone: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export function getScreenLayout(width: number): ScreenLayoutState {
  const normalizedWidth = Math.max(0, Math.floor(width));
  const isDesktop = normalizedWidth >= DESKTOP_MIN_WIDTH;
  const isTablet = normalizedWidth >= TABLET_MIN_WIDTH && !isDesktop;
  const isPhone = normalizedWidth < TABLET_MIN_WIDTH;
  const isCompactPhone = normalizedWidth <= COMPACT_PHONE_MAX_WIDTH;

  return {
    width: normalizedWidth,
    isCompactPhone,
    isPhone,
    isTablet,
    isDesktop,
  };
}
