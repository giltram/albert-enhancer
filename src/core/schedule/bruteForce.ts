import type { EnrollmentOption } from '../courses/types';
import { scheduleHasConflict } from './conflicts';
import type { ScheduleCandidate, ScheduleProblem } from './types';

/** Intentionally simple reference implementation used by property tests. */
export function bruteForceSchedules(problem: ScheduleProblem): readonly ScheduleCandidate[] {
  const intents = [...problem.intents].sort((a, b) => a.courseId.localeCompare(b.courseId));
  if (new Set(intents.map((intent) => intent.courseId)).size !== intents.length) return [];
  const excluded = new Set(problem.registration.excludedOptionIds);
  const lockedIds = Object.entries(problem.registration.optionStatuses)
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id);
  if (lockedIds.some((id) => !problem.options.some((option) => option.id === id))) return [];
  const lockedSectionIds = Object.entries(problem.registration.sectionStatuses ?? {})
    .filter(([, status]) => status === 'locked')
    .map(([id]) => id);
  if (lockedSectionIds.some((id) => !problem.options.some((option) => option.sectionIds.includes(id)))) return [];

  const groups: (readonly (EnrollmentOption | undefined)[])[] = intents.map((intent) => {
    const allowedIds = intent.optionIds === undefined ? undefined : new Set(intent.optionIds);
    const requiredSections = new Set(intent.requiredSectionIds);
    const excludedSections = new Set([
      ...(intent.excludedSectionIds ?? []),
      ...(problem.registration.excludedSectionIds ?? []),
    ]);
    const courseLockedSections = lockedSectionIds.filter((id) => problem.options.some(
      (option) => option.courseId === intent.courseId && option.sectionIds.includes(id),
    ));
    const options = problem.options
      .filter((option) => option.courseId === intent.courseId)
      .filter((option) => allowedIds?.has(option.id) ?? true)
      .filter((option) => !excluded.has(option.id))
      .filter((option) => [...requiredSections, ...courseLockedSections].every((id) => option.sectionIds.includes(id)))
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
    const locked = options.filter((option) => problem.registration.optionStatuses[option.id] === 'locked');
    if (locked.length > 0) return locked;
    return intent.required ? options : [undefined, ...options];
  });

  const products = groups.reduce<(readonly (EnrollmentOption | undefined)[])[]>(
    (rows, group) => rows.flatMap((row) => group.map((option) => [...row, option])),
    [[]],
  );

  return products
    .map((row) => row.filter((option): option is EnrollmentOption => option !== undefined))
    .filter((options) => !scheduleHasConflict(options))
    .filter((options) => lockedIds.every((id) => options.some((option) => option.id === id)))
    .filter((options) => lockedSectionIds.every((id) => options.some((option) => option.sectionIds.includes(id))))
    .map((options) => ({ id: options.map((option) => option.id).sort().join('|'), options }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
