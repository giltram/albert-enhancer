import { rankedScheduleSearch } from '../../core/schedule';
import type { ScheduleSearchResult, SearchBudget } from '../../core/schedule';
import type { SchedulePreferences, ScheduleProblem } from '../../core/schedule';

/** Cooperatively yields every 8 ms; callers abort stale work on state changes. */
export async function searchSchedulePreview(
  problem: ScheduleProblem,
  preferences: SchedulePreferences,
  signal: AbortSignal,
  budget?: SearchBudget,
): Promise<ScheduleSearchResult | undefined> {
  const search = rankedScheduleSearch(problem, preferences, budget);
  while (!signal.aborted) {
    const until = performance.now() + 8;
    do {
      const next = search.next();
      if (next.done) return signal.aborted ? undefined : next.value;
    } while (!signal.aborted && performance.now() < until);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  search.return({ schedules: [], count: 0, complete: false });
  return undefined;
}
