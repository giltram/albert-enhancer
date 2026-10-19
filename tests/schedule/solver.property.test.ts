import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { EnrollmentOption, ScheduleProblem, Weekday } from '../../src/core';
import { bruteForceSchedules, scheduleHasConflict, solveSchedules } from '../../src/core/schedule';

const days: readonly Weekday[] = ['monday', 'tuesday', 'wednesday'];

const problemArbitrary = fc.integer({ min: 1, max: 4 }).chain((courseCount) =>
  fc.array(
    fc.record({
      dayIndex: fc.integer({ min: 0, max: days.length - 1 }),
      startSlot: fc.integer({ min: 0, max: 6 }),
      duration: fc.integer({ min: 1, max: 3 }),
    }),
    { minLength: courseCount, maxLength: courseCount * 3 },
  ).map((rows): ScheduleProblem => {
    const counters = Array.from({ length: courseCount }, () => 0);
    const options: EnrollmentOption[] = rows.map((row, index) => {
      const courseIndex = index % courseCount;
      const optionIndex = counters[courseIndex]!;
      counters[courseIndex] = optionIndex + 1;
      return {
        id: `c${courseIndex}-o${optionIndex}`,
        courseId: `c${courseIndex}`,
        sectionIds: [`s${index}`],
        instructors: [],
        meetings: [{
          day: days[row.dayIndex]!,
          startMinute: 480 + row.startSlot * 30,
          endMinute: 480 + (row.startSlot + row.duration) * 30,
        }],
      };
    });
    return {
      intents: Array.from({ length: courseCount }, (_, index) => ({ courseId: `c${index}`, required: index % 3 !== 2 })),
      options,
      registration: { optionStatuses: {}, excludedOptionIds: [] },
    };
  }),
);

describe('optimized solver properties', () => {
  it('matches brute force for random small datasets', () => {
    fc.assert(fc.property(problemArbitrary, (problem) => {
      expect(solveSchedules(problem).map((candidate) => candidate.id))
        .toEqual(bruteForceSchedules(problem).map((candidate) => candidate.id));
    }), { numRuns: 500 });
  });

  it('returns conflict-free deterministic schedules independent of input order', () => {
    fc.assert(fc.property(problemArbitrary, (problem) => {
      const first = solveSchedules(problem);
      const reversed = solveSchedules({
        ...problem,
        intents: [...problem.intents].reverse(),
        options: [...problem.options].reverse(),
      });
      expect(first.every((candidate) => !scheduleHasConflict(candidate.options))).toBe(true);
      expect(first.map((candidate) => candidate.id)).toEqual(reversed.map((candidate) => candidate.id));
      expect(solveSchedules(problem)).toEqual(first);
    }), { numRuns: 300 });
  });
});
