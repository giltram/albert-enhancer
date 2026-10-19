import type { EnrollmentOption } from '../courses/types';
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

function choicesForIntent(problem: ScheduleProblem, intent: CourseIntent): readonly Choice[] {
  const allowedIds = intent.optionIds === undefined ? undefined : new Set(intent.optionIds);
  const excluded = new Set(problem.registration.excludedOptionIds);
  const requiredSections = new Set(intent.requiredSectionIds);
  const excludedSections = new Set([
    ...(intent.excludedSectionIds ?? []),
    ...(problem.registration.excludedSectionIds ?? []),
  ]);
  const lockedSections = Object.entries(problem.registration.sectionStatuses ?? {})
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id)
    .filter((id) => problem.options.some((option) => option.courseId === intent.courseId && option.sectionIds.includes(id)));
  const matching = problem.options
    .filter((option) => option.courseId === intent.courseId)
    .filter((option) => allowedIds?.has(option.id) ?? true)
    .filter((option) => !excluded.has(option.id))
    .filter((option) => [...requiredSections, ...lockedSections].every((id) => option.sectionIds.includes(id)))
    .filter((option) => option.sectionIds.every((id) => !excludedSections.has(id)))
    .filter((option) => {
      const status = problem.registration.optionStatuses[option.id] ?? 'available';
      if (status === 'unavailable' || status === 'waitlisted') return false;
      return option.sectionIds.every((id) => {
        const sectionStatus = problem.registration.sectionStatuses?.[id] ?? 'available';
        return sectionStatus !== 'unavailable' && sectionStatus !== 'waitlisted';
      });
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const locked = matching.filter(
    (option) => problem.registration.optionStatuses[option.id] === 'locked',
  );
  if (locked.length > 0) return locked;
  return intent.required ? matching : [NONE, ...matching];
}

/**
 * Enumerates feasible schedules with DFS and rejects conflicts as soon as a
 * choice is added. It never materializes the full Cartesian product.
 */
export function solveSchedules(problem: ScheduleProblem): readonly ScheduleCandidate[] {
  const intents = orderedIntents(problem.intents);
  if (new Set(intents.map((intent) => intent.courseId)).size !== intents.length) return [];

  const lockedIds = Object.entries(problem.registration.optionStatuses)
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id);
  const relevantOptionIds = new Set(problem.options.map((option) => option.id));
  if (lockedIds.some((id) => !relevantOptionIds.has(id))) return [];
  const relevantSectionIds = new Set(problem.options.flatMap((option) => option.sectionIds));
  const lockedSectionIds = Object.entries(problem.registration.sectionStatuses ?? {})
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id);
  if (lockedSectionIds.some((id) => !relevantSectionIds.has(id))) return [];

  const results: ScheduleCandidate[] = [];
  const selected: EnrollmentOption[] = [];

  function visit(index: number): void {
    if (index === intents.length) {
      const present = new Set(selected.map((option) => option.id));
      if (!lockedIds.every((id) => present.has(id))) return;
      const presentSections = new Set(selected.flatMap((option) => option.sectionIds));
      if (!lockedSectionIds.every((id) => presentSections.has(id))) return;
      const options = [...selected];
      results.push({ id: candidateId(options), options });
      return;
    }

    const intent = intents[index]!;
    for (const choice of choicesForIntent(problem, intent)) {
      if (choice === NONE) {
        visit(index + 1);
      } else if (!selected.some((existing) => optionsConflict(existing, choice))) {
        selected.push(choice);
        visit(index + 1);
        selected.pop();
      }
    }
  }

  visit(0);
  return results.sort((a, b) => a.id.localeCompare(b.id));
}
