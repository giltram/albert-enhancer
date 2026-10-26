import { describe, expect, it } from 'vitest';
import { defaultSchedulePreferences, rankSchedules, solveSchedules } from '../../src/core/schedule';
import type { ScheduleProblem } from '../../src/core/schedule';
import { rankedScheduleSearch } from '../../src/core/schedule/search';
import { searchSchedulePreview } from '../../src/features/planner/scheduleSearch';

const problem: ScheduleProblem = {
  intents: Array.from({ length: 7 }, (_, i) => ({ courseId: `c${i}`, required: true })),
  options: Array.from({ length: 7 }, (_, i) => Array.from({ length: 7 }, (_, j) => ({
    id: `c${i}:${j}`, courseId: `c${i}`, sectionIds: [`c${i}:${j}`], meetings: [], instructors: [],
  }))).flat(),
  registration: { optionStatuses: {}, excludedOptionIds: [] },
};

describe('bounded ranked schedule search', () => {
  it('bounds enumeration plus ranking for low-conflict 7 × 7 inputs', () => {
    const start = performance.now();
    const search = rankedScheduleSearch(problem, defaultSchedulePreferences);
    let next = search.next();
    while (!next.done) next = search.next();
    expect(next.value.count).toBe(2_000);
    expect(next.value.complete).toBe(false);
    expect(next.value.schedules).toHaveLength(8);
    expect(performance.now() - start).toBeLessThan(2_000);
  });
  it('matches exhaustive ranking whenever search completes', () => {
    const small = { ...problem, intents: problem.intents.slice(0, 2), options: problem.options.slice(0, 14) };
    const search = rankedScheduleSearch(small, defaultSchedulePreferences);
    let next = search.next();
    while (!next.done) next = search.next();
    expect(next.value.complete).toBe(true);
    expect(next.value.count).toBe(49);
    expect(next.value.schedules).toEqual(rankSchedules(solveSchedules(small), defaultSchedulePreferences, small).slice(0, 8));
  });
  it('marks exhausted node budgets as incomplete even without a candidate', () => {
    const search = rankedScheduleSearch(problem, defaultSchedulePreferences, { maxCandidates: 10, maxSteps: 1 });
    search.next();
    expect(search.next()).toMatchObject({ done: true, value: { complete: false, count: 0 } });
  });
  it('yields to other tasks and cancels superseded work', async () => {
    const controller = new AbortController();
    const pending = searchSchedulePreview(problem, defaultSchedulePreferences, controller.signal);
    setTimeout(() => controller.abort(), 0);
    expect(await pending).toBeUndefined();
  });
});
