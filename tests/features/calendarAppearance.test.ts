import { describe, expect, it } from 'vitest';
import { calendarCourseColors, plannerComponentLabel } from '../../src/features/planner/calendarAppearance';

describe('Schedule Lab calendar appearance', () => {
  it('assigns one color per course regardless of how many options or components it has', () => {
    const colors = calendarCourseColors(['cs101', 'econ101', 'cs101', 'econ101']);
    expect(colors.size).toBe(2);
    expect(colors.get('cs101')).not.toEqual(colors.get('econ101'));
    expect(colors).toEqual(calendarCourseColors(['cs101', 'econ101']));
  });

  it('keeps existing colors when adding courses, without cycling through a small palette', () => {
    const original = calendarCourseColors(['cs101', 'econ101']);
    const expanded = calendarCourseColors(['cs101', 'econ101', ...Array.from({ length: 20 }, (_, index) => `course${index}`)]);
    expect(expanded.get('cs101')).toEqual(original.get('cs101'));
    expect(expanded.get('econ101')).toEqual(original.get('econ101'));
    expect(new Set([...expanded.values()].map((color) => color.background)).size).toBe(expanded.size);
  });

  it('labels lectures and recitations with the requested lowercase abbreviations', () => {
    expect(plannerComponentLabel({ sectionId: 'lec001', sectionCode: '001', componentType: 'lecture' })).toBe('lec 001');
    expect(plannerComponentLabel({ sectionId: 'rec011', sectionCode: '011', componentType: 'recitation' })).toBe('reci 011');
    expect(plannerComponentLabel({ sectionId: 'lab003', sectionCode: '003', componentType: 'lab' })).toBe('lab 003');
  });

  it('preserves identifiers when component display metadata is missing', () => {
    expect(plannerComponentLabel({ sectionId: 'legacy:001', componentType: 'other' })).toBe('legacy:001');
    expect(plannerComponentLabel({ sectionId: 'section001', sectionCode: '001', componentType: 'other' })).toBe('001');
  });
});
