import { searchSchedules } from './solver';
import { scoreSchedule } from './ranking';
import type { RankedSchedule, SchedulePreferences } from './ranking';
import type { ScheduleProblem } from './types';

export interface SearchBudget {
  readonly maxCandidates: number;
  readonly maxSteps: number;
}
export interface ScheduleSearchResult {
  readonly schedules: readonly RankedSchedule[];
  readonly count: number;
  readonly complete: boolean;
}
export const defaultSearchBudget: SearchBudget = { maxCandidates: 2_000, maxSteps: 20_000 };

/** Yields after each search step or scored candidate; retains only the best eight. */
export function* rankedScheduleSearch(
  problem: ScheduleProblem,
  preferences: SchedulePreferences,
  budget: SearchBudget = defaultSearchBudget,
): Generator<void, ScheduleSearchResult> {
  const search = searchSchedules(problem);
  const best: RankedSchedule[] = [];
  let count = 0;
  let steps = 0;
  for (const candidate of search) {
    steps += 1;
    if (candidate !== undefined) {
      count += 1;
      best.push({ ...candidate, score: scoreSchedule(candidate, preferences, problem) });
      best.sort((a, b) => b.score.totalScore - a.score.totalScore || a.id.localeCompare(b.id));
      if (best.length > 8) best.pop();
    }
    yield;
    if (count >= budget.maxCandidates || steps >= budget.maxSteps) {
      return { schedules: best, count, complete: false };
    }
  }
  return { schedules: best, count, complete: true };
}
