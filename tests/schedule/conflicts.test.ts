import { describe, expect, it } from 'vitest';
import { meetingsConflict } from '../../src/core/schedule';

describe('meetingsConflict', () => {
  it('treats adjacent classes as non-conflicting', () => {
    expect(meetingsConflict(
      { day: 'monday', startMinute: 600, endMinute: 675 },
      { day: 'monday', startMinute: 675, endMinute: 750 },
    )).toBe(false);
  });

  it.each([
    [600, 675, 650, 700],
    [600, 750, 625, 675],
    [625, 675, 600, 750],
  ])('detects overlap and containment', (aStart, aEnd, bStart, bEnd) => {
    expect(meetingsConflict(
      { day: 'tuesday', startMinute: aStart, endMinute: aEnd },
      { day: 'tuesday', startMinute: bStart, endMinute: bEnd },
    )).toBe(true);
  });

  it('does not conflict across weekdays', () => {
    expect(meetingsConflict(
      { day: 'monday', startMinute: 600, endMinute: 750 },
      { day: 'wednesday', startMinute: 600, endMinute: 750 },
    )).toBe(false);
  });
});
