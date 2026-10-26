import { describe, expect, it } from 'vitest';
import type { EnrollmentOption, ScheduleProblem } from '../../src/core';
import { defaultSchedulePreferences, rankSchedules, solveSchedules } from '../../src/core/schedule';

const early: EnrollmentOption = {
  id: 'course-early', courseId: 'course', sectionIds: ['early'],
  meetings: [{ day: 'monday', startMinute: 480, endMinute: 540 }],
  instructors: [{ name: 'Professor Early' }],
};
const late: EnrollmentOption = {
  id: 'course-late', courseId: 'course', sectionIds: ['late'],
  meetings: [{ day: 'monday', startMinute: 720, endMinute: 780 }],
  instructors: [{ name: 'Professor Late' }],
};
const problem: ScheduleProblem = {
  intents: [{ courseId: 'course', required: true }],
  options: [early, late],
  registration: { optionStatuses: {}, excludedOptionIds: [] },
};

describe('schedule ranking', () => {
  it('never changes the feasible set', () => {
    const feasible = solveSchedules(problem);
    expect(new Set(rankSchedules(feasible).map((schedule) => schedule.id)))
      .toEqual(new Set(feasible.map((schedule) => schedule.id)));
  });

  it('responds monotonically to professor preference', () => {
    const feasible = solveSchedules(problem);
    const ranked = rankSchedules(feasible, {
      ...defaultSchedulePreferences,
      preferredInstructors: { 'Professor Late': 10 },
    });
    expect(ranked[0]!.id).toBe('course-late');
    expect(ranked[0]!.score.professorScore).toBeGreaterThan(ranked[1]!.score.professorScore);
  });

  it('does not improve an early class when the early penalty is enabled', () => {
    const feasible = solveSchedules(problem);
    const before = rankSchedules(feasible).find((schedule) => schedule.id === 'course-early')!;
    const after = rankSchedules(feasible, { ...defaultSchedulePreferences, avoidBeforeMinute: 600 })
      .find((schedule) => schedule.id === 'course-early')!;
    expect(after.score.timeScore).toBeLessThanOrEqual(before.score.timeScore);
  });

  it('reports backup robustness deterministically', () => {
    const ranked = rankSchedules(solveSchedules(problem), defaultSchedulePreferences, problem);
    expect(ranked.every((schedule) => schedule.score.robustnessScore === 100)).toBe(true);
    expect(rankSchedules(solveSchedules(problem), defaultSchedulePreferences, problem)).toEqual(ranked);
  });

  it.each(['allowlist', 'exact-lock', 'section-lock', 'excluded'])('does not count prohibited backups: %s', (constraint) => {
    const constrained: ScheduleProblem = {
      ...problem,
      intents: [{ courseId: 'course', required: true, ...(constraint === 'allowlist' ? { optionIds: [early.id] } : {}) }],
      registration: {
        optionStatuses: constraint === 'exact-lock' ? { [early.id]: 'locked' } : {},
        excludedOptionIds: constraint === 'excluded' ? [late.id] : [],
        sectionStatuses: constraint === 'section-lock' ? { early: 'locked' } : {},
      },
    };
    const ranked = rankSchedules(solveSchedules(constrained), defaultSchedulePreferences, constrained);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.score.robustnessScore).toBe(0);
  });

  it('uses component preferences as a soft ranking signal', () => {
    const preferredProblem: ScheduleProblem = {
      ...problem,
      intents: [{ courseId: 'course', required: true, preferredSectionIds: ['late'] }],
    };
    const ranked = rankSchedules(solveSchedules(preferredProblem), defaultSchedulePreferences, preferredProblem);
    expect(ranked[0]!.id).toBe('course-late');
    expect(ranked[0]!.score.sectionPreferenceScore).toBe(1);
  });
});
