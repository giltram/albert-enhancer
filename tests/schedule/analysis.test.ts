import { describe, expect, it } from 'vitest';
import type { EnrollmentOption } from '../../src/core';
import { analyzeCourseConflict } from '../../src/core/schedule';

const option = (id: string, courseId: string, startMinute: number): EnrollmentOption => ({
  id, courseId, sectionIds: [id], instructors: [], meetings: [{ day: 'monday', startMinute, endMinute: startMinute + 60 }],
});

describe('conflict matrix analysis', () => {
  it('reports the fraction and exact conflicting option pairs', () => {
    const result = analyzeCourseConflict('a', 'b', [option('a1', 'a', 600), option('a2', 'a', 720), option('b1', 'b', 630), option('b2', 'b', 900)]);
    expect(result.ratio).toBe(0.25);
    expect(result.conflictingPairs).toEqual([{ leftOptionId: 'a1', rightOptionId: 'b1' }]);
  });
});
