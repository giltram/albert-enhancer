import type { EnrollmentOption } from '../courses/types';
import { eligibleOptions } from './eligibility';
import { optionsConflict } from './conflicts';
import type { CourseIntent, ScheduleCandidate, ScheduleProblem } from './types';

const NONE = Symbol('optional-course-not-selected');
type Choice = EnrollmentOption | typeof NONE;

function candidateId(options: readonly EnrollmentOption[]): string {
  return options.map((option) => option.id).sort().join('|');
}

function orderedIntents(intents: readonly CourseIntent[]): readonly CourseIntent[] {
  return [...intents].sort((a, b) => a.courseId.localeCompare(b.courseId));
}

/**
 * Enumerates feasible schedules with DFS and rejects conflicts as soon as a
 * choice is added. It never materializes the full Cartesian product.
 */
export function* searchSchedules(problem: ScheduleProblem): Generator<ScheduleCandidate | undefined> {
  const intents = orderedIntents(problem.intents);
  if (new Set(intents.map((intent) => intent.courseId)).size !== intents.length) return;

  const lockedIds = Object.entries(problem.registration.optionStatuses)
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id);
  const relevantOptionIds = new Set(problem.options.map((option) => option.id));
  if (lockedIds.some((id) => !relevantOptionIds.has(id))) return;
  const relevantSectionIds = new Set(problem.options.flatMap((option) => option.sectionIds));
  const lockedSectionIds = Object.entries(problem.registration.sectionStatuses ?? {})
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id);
  if (lockedSectionIds.some((id) => !relevantSectionIds.has(id))) return;

  const choices = intents.map((intent): readonly Choice[] => {
    const matching = eligibleOptions(problem, intent);
    const hasLock = problem.options.some((option) => option.courseId === intent.courseId && lockedIds.includes(option.id));
    return intent.required || hasLock ? matching : [NONE, ...matching];
  });
  const selected: EnrollmentOption[] = [];

  function* visit(index: number): Generator<ScheduleCandidate | undefined> {
    yield undefined;
    if (index === intents.length) {
      const present = new Set(selected.map((option) => option.id));
      if (!lockedIds.every((id) => present.has(id))) return;
      const presentSections = new Set(selected.flatMap((option) => option.sectionIds));
      if (!lockedSectionIds.every((id) => presentSections.has(id))) return;
      const options = [...selected];
      yield { id: candidateId(options), options };
      return;
    }

    for (const choice of choices[index]!) {
      yield undefined;
      if (choice === NONE) {
        yield* visit(index + 1);
      } else if (!selected.some((existing) => optionsConflict(existing, choice))) {
        selected.push(choice);
        yield* visit(index + 1);
        selected.pop();
      }
    }
  }

  yield* visit(0);
}

/** Exhaustive API for small problems and reference tests. UI uses bounded search. */
export function solveSchedules(problem: ScheduleProblem): readonly ScheduleCandidate[] {
  const results: ScheduleCandidate[] = [];
  for (const value of searchSchedules(problem)) if (value !== undefined) results.push(value);
  return results.sort((a, b) => a.id.localeCompare(b.id));
}
