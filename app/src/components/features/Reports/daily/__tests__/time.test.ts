import { toRFC3339RangeEnd, toRFC3339RangeStart } from '../time';

describe('daily report time helpers', () => {
  it('builds Turkish day boundaries in UTC', () => {
    const reportDay = new Date('2026-03-01T12:00:00.000Z');

    expect(toRFC3339RangeStart(reportDay)).toBe('2026-02-28T21:00:00.000Z');
    expect(toRFC3339RangeEnd(reportDay)).toBe('2026-03-01T20:59:59.999Z');
  });

  it('builds UTC day boundaries when requested', () => {
    const reportDay = new Date('2026-03-01T12:00:00.000Z');

    expect(toRFC3339RangeStart(reportDay, 'UTC')).toBe('2026-03-01T00:00:00.000Z');
    expect(toRFC3339RangeEnd(reportDay, 'UTC')).toBe('2026-03-01T23:59:59.999Z');
  });
});
