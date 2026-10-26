import type { EnrollmentOption } from '../courses/types';
import type { CourseIntent, ScheduleProblem } from './types';

/** Shared course-local feasibility rules for search and replacement scoring. */
export function eligibleOptions(problem: ScheduleProblem, intent: CourseIntent): readonly EnrollmentOption[] {
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

  const lockedIds = problem.options.filter((option) => option.courseId === intent.courseId
    && problem.registration.optionStatuses[option.id] === 'locked').map((option) => option.id);
  return lockedIds.length === 0 ? matching : matching.filter((option) => lockedIds.includes(option.id));
}
