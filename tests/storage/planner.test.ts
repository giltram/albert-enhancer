import { describe, expect, it } from 'vitest';
import { emptyPlannerData, mergeEnrollmentOptions, normalizePlannerData, removeCourseFromPlanner } from '../../src/storage/plannerData';
import type { PlannerData } from '../../src/storage/plannerData';

describe('planner persistence migration', () => {
  it('upgrades one lecture group without losing other lecture bundles or their outcomes', () => {
    const course = { id: 'c', code: 'C 1', title: 'Course' };
    const option = (id: string, sectionIds: readonly string[]) => ({ id, courseId: 'c', sectionIds, meetings: [], instructors: [] });
    const old: PlannerData = {
      ...emptyPlannerData,
      courses: [course],
      intents: [{ courseId: 'c', required: false, requiredSectionIds: ['rec-obsolete'], preferredSectionIds: ['lec2'] }],
      options: [option('lec1', ['lec1']), option('rec-obsolete', ['rec-obsolete']), option('other-bundle', ['lec2', 'rec2'])],
      registration: {
        present: { optionStatuses: { lec1: 'locked', 'other-bundle': 'available' }, excludedOptionIds: ['lec1'], sectionStatuses: { 'rec-obsolete': 'unavailable', rec2: 'locked' }, excludedSectionIds: ['rec-obsolete'] },
        past: [{ optionStatuses: { lec1: 'locked' }, excludedOptionIds: ['lec1'] }],
      },
    };
    const added = [option('new-bundle', ['lec1', 'rec1'])];
    const next = mergeEnrollmentOptions(old, course, 'lec1', ['lec1', 'rec1', 'rec-obsolete'], added);
    expect(next.options.map((item) => item.id)).toEqual(['other-bundle', 'new-bundle']);
    expect(next.intents[0]).toMatchObject({ required: false, requiredSectionIds: [], preferredSectionIds: ['lec2'] });
    expect(next.registration.present).toMatchObject({ optionStatuses: { 'other-bundle': 'available' }, excludedOptionIds: [], sectionStatuses: { rec2: 'locked' }, excludedSectionIds: [] });
    expect(next.registration.past[0]?.optionStatuses).toEqual({});
    expect(mergeEnrollmentOptions(next, course, 'lec1', ['lec1', 'rec1'], added)).toEqual(next);
    expect(mergeEnrollmentOptions(old, course, 'lec1', ['lec1'], [])).toBe(old);
  });

  it('preserves course order when reimporting another primary, keeping calendar colors stable', () => {
    const course = { id: 'a', code: 'A', title: 'A' };
    const value = { ...emptyPlannerData, courses: [course, { id: 'b', code: 'B', title: 'B' }] };
    const option = { id: 'a:002', courseId: 'a', sectionIds: ['a:002'], meetings: [], instructors: [] };
    expect(mergeEnrollmentOptions(value, course, 'a:002', ['a:002'], [option]).courses.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('upgrades legacy single-section plans without changing option IDs', () => {
    const legacy = {
      courses: [{ id: 'c', code: 'C 1', title: 'Course' }],
      options: [{ id: 'c:001', courseId: 'c', sectionIds: ['c:001'], meetings: [], instructors: [] }],
      intents: [{ courseId: 'c', required: true }],
      registration: { present: { optionStatuses: {}, excludedOptionIds: [] }, past: [] },
      preferences: {
        preferredInstructors: {}, dislikedInstructors: {}, avoidFriday: false,
        weights: { professor: 1, time: 1, compactness: 1, daysOff: 1, robustness: 1 },
      },
    } as unknown as PlannerData;
    const migrated = normalizePlannerData(legacy);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.options[0]?.id).toBe('c:001');
    expect(migrated.registration.present.sectionStatuses).toEqual({});
    expect(migrated.preferences.weights.sectionPreference).toBe(1);
  });

  it('removes a course together with its saved option and section outcomes', () => {
    const value: PlannerData = {
      ...emptyPlannerData,
      courses: [{ id: 'c', code: 'C 1', title: 'Course' }],
      intents: [{ courseId: 'c', required: true }],
      options: [{ id: 'c:001', courseId: 'c', sectionIds: ['c:001'], meetings: [], instructors: [] }],
      registration: {
        present: {
          optionStatuses: { 'c:001': 'waitlisted' }, excludedOptionIds: ['c:001'],
          sectionStatuses: { 'c:001': 'unavailable' }, excludedSectionIds: ['c:001'],
        },
        past: [{
          optionStatuses: { 'c:001': 'locked' }, excludedOptionIds: ['c:001'],
          sectionStatuses: { 'c:001': 'waitlisted' }, excludedSectionIds: ['c:001'],
        }],
      },
    };

    const removed = removeCourseFromPlanner(value, 'c');
    expect(removed.courses).toEqual([]);
    expect(removed.intents).toEqual([]);
    expect(removed.options).toEqual([]);
    expect(removed.registration.present).toEqual({ optionStatuses: {}, excludedOptionIds: [], sectionStatuses: {}, excludedSectionIds: [] });
    expect(removed.registration.past[0]).toEqual({ optionStatuses: {}, excludedOptionIds: [], sectionStatuses: {}, excludedSectionIds: [] });
  });
});
