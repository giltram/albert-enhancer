import { describe, expect, it } from 'vitest';
import { emptyPlannerData, normalizePlannerData, removeCourseFromPlanner } from '../../src/storage/plannerData';
import type { PlannerData } from '../../src/storage/plannerData';

describe('planner persistence migration', () => {
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
