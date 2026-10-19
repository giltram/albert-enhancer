import { describe, expect, it } from 'vitest';
import { calendarBounds, calendarLocationLabel, calendarPlacement } from '../../src/features/planner/calendarLayout';

describe('Schedule Lab calendar layout', () => {
  it('positions meetings by clock time instead of list order', () => {
    const morning = { day: 'monday' as const, startMinute: 9 * 60, endMinute: 10 * 60 };
    const afternoon = { day: 'monday' as const, startMinute: 14 * 60, endMinute: 15 * 60 + 15 };
    const bounds = calendarBounds([afternoon, morning]);
    const morningPlacement = calendarPlacement(morning, bounds);
    const afternoonPlacement = calendarPlacement(afternoon, bounds);
    expect(bounds).toEqual({ startMinute: 480, endMinute: 1260 });
    expect(morningPlacement.topPercent).toBeLessThan(afternoonPlacement.topPercent);
    expect(afternoonPlacement.topPercent).toBeCloseTo(46.15, 1);
    expect(afternoonPlacement.heightPercent).toBeCloseTo(9.62, 1);
  });

  it('expands the axis for unusually early or late classes', () => {
    const bounds = calendarBounds([{ day: 'friday', startMinute: 450, endMinute: 1325 }]);
    expect(bounds).toEqual({ startMinute: 420, endMinute: 1380 });
  });

  it('shows only the room for the single Shanghai teaching address', () => {
    expect(calendarLocationLabel('567 West Yangsi Rd, Shanghai Room EB224')).toBe('EB224');
    expect(calendarLocationLabel('6 MetroTech Center, Brooklyn Room 101')).toBe('6 MetroTech Center, Brooklyn Room 101');
  });
});
