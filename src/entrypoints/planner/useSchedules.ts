import { useEffect, useState } from 'react';
import type { ScheduleProblem, SchedulePreferences } from '../../core/schedule';
import type { ScheduleSearchResult } from '../../core/schedule';
import { searchSchedulePreview } from '../../features/planner/scheduleSearch';

export function useSchedules(problem: ScheduleProblem, preferences: SchedulePreferences): ScheduleSearchResult | undefined {
  const [state, setState] = useState<{ problem: ScheduleProblem; preferences: SchedulePreferences; result: ScheduleSearchResult }>();
  useEffect(() => {
    const controller = new AbortController();
    void searchSchedulePreview(problem, preferences, controller.signal).then((result) => {
      if (result !== undefined && !controller.signal.aborted) setState({ problem, preferences, result });
    });
    return () => controller.abort();
  }, [problem, preferences]);
  return state?.problem === problem && state.preferences === preferences ? state.result : undefined;
}
