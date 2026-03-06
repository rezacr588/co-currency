import {
  REPORT_TIME_ZONE,
  formatDateKey,
  getDateRangeFromPreset,
  getMonthLabelAnchor,
  shiftCalendarDate,
} from '../dateRange';

describe('report date helpers', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('formats report dates in Turkish time', () => {
    const instant = new Date('2026-03-01T22:30:00.000Z');

    expect(formatDateKey(instant, REPORT_TIME_ZONE)).toBe('2026-03-02');
  });

  it('uses the Turkish current date for all-time presets', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T22:30:00.000Z'));

    expect(getDateRangeFromPreset('all_time').toDate).toBe('2026-03-02');
  });

  it('accepts an explicit timezone override for presets', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T22:30:00.000Z'));

    expect(getDateRangeFromPreset('all_time', 'UTC').toDate).toBe('2026-03-01');
  });

  it('shifts calendar dates without depending on device timezone', () => {
    expect(shiftCalendarDate({ year: 2026, month: 3, day: 1 }, -7)).toEqual({
      year: 2026,
      month: 2,
      day: 22,
    });
  });

  it('uses a timezone-neutral month anchor for month labels', () => {
    const januaryAnchor = getMonthLabelAnchor(0);

    expect(
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        timeZone: 'UTC',
      }).format(januaryAnchor)
    ).toBe('January');
    expect(
      new Intl.DateTimeFormat('en-US', {
        month: 'long',
        timeZone: 'America/Los_Angeles',
      }).format(januaryAnchor)
    ).toBe('January');
  });
});
