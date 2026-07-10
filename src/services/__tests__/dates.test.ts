import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localISODate, localWeekRange } from '../../domain/dates';

describe('localISODate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the local calendar date, not the UTC date', () => {
    // 2026-07-09 01:30 local (any tz): local date is 09, even if UTC is 08/10.
    vi.setSystemTime(new Date(2026, 6, 9, 1, 30));
    expect(localISODate(0)).toBe('2026-07-09');
  });

  it('applies a negative offset (yesterday in local time)', () => {
    vi.setSystemTime(new Date(2026, 6, 9, 23, 59));
    expect(localISODate(-1)).toBe('2026-07-08');
  });

  it('applies a positive offset and rolls the month', () => {
    vi.setSystemTime(new Date(2026, 6, 31, 0, 0));
    expect(localISODate(1)).toBe('2026-08-01');
  });
});

describe('localWeekRange', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns Monday–Sunday for a Wednesday', () => {
    // 2026-07-08 is a Wednesday
    vi.setSystemTime(new Date(2026, 6, 8, 12, 0));
    const { start, end } = localWeekRange();
    expect(start).toBe('2026-07-06'); // Monday
    expect(end).toBe('2026-07-12');   // Sunday
  });

  it('returns Monday–Sunday for a Sunday (week starts Monday)', () => {
    // 2026-07-12 is a Sunday
    vi.setSystemTime(new Date(2026, 6, 12, 12, 0));
    const { start, end } = localWeekRange();
    expect(start).toBe('2026-07-06'); // Monday
    expect(end).toBe('2026-07-12');   // Sunday
  });

  it('handles month boundary (Mon 31 Aug → Sun 6 Sep)', () => {
    // 2026-08-31 is a Monday
    vi.setSystemTime(new Date(2026, 7, 31, 12, 0));
    const { start, end } = localWeekRange();
    expect(start).toBe('2026-08-31');
    expect(end).toBe('2026-09-06');
  });
});