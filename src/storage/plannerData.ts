import type { Course, EnrollmentOption } from '../core/courses';
import type { RegistrationHistory } from '../core/registration';
import { emptyRegistrationState } from '../core/registration';
import type { CourseIntent, RegistrationState, SchedulePreferences } from '../core/schedule';
import { defaultSchedulePreferences } from '../core/schedule';

export interface PlannerData {
  readonly schemaVersion: 2;
  /** One term per planner. null means legacy/unidentified offerings; never infer. */
  readonly term?: string | null;
  readonly courses: readonly Course[];
  readonly options: readonly EnrollmentOption[];
  readonly intents: readonly CourseIntent[];
  readonly registration: RegistrationHistory;
  readonly preferences: SchedulePreferences;
}

export const emptyPlannerData: PlannerData = {
  schemaVersion: 2,
  courses: [],
  options: [],
  intents: [],
  registration: { present: emptyRegistrationState, past: [] },
  preferences: defaultSchedulePreferences,
};

/** Replace one primary's alternatives and its legacy standalone components. */
export function mergeEnrollmentOptions(
  value: PlannerData,
  course: Course,
  primarySectionId: string,
  groupSectionIds: readonly string[],
  options: readonly EnrollmentOption[],
  term?: string,
): PlannerData {
  if (options.length === 0) return value;
  if (term !== undefined && value.options.length > 0 && value.term !== term) {
    throw new Error(`This plan belongs to ${value.term ?? 'an unknown semester (legacy data)'}. Export it if needed, then remove its courses before importing ${term}.`);
  }
  const groupIds = new Set(groupSectionIds);
  const removed = value.options.filter((option) => option.courseId === course.id
    && (option.sectionIds.includes(primarySectionId)
      || (option.sectionIds.length === 1 && groupIds.has(option.sectionIds[0]!))));
  const removedIds = new Set(removed.map((option) => option.id));
  const nextOptions = [...value.options.filter((option) => !removedIds.has(option.id)), ...options];
  const keptOptionIds = new Set(nextOptions.map((option) => option.id));
  const staleOptionIds = new Set([...removedIds].filter((id) => !keptOptionIds.has(id)));
  const keptSectionIds = new Set(nextOptions.flatMap((option) => option.sectionIds));
  const staleSectionIds = new Set(removed.flatMap((option) => option.sectionIds).filter((id) => !keptSectionIds.has(id)));
  const cleanIds = (ids: readonly string[] | undefined): readonly string[] => (ids ?? []).filter((id) => !staleSectionIds.has(id));
  return {
    ...value,
    ...(term === undefined ? {} : { term }),
    courses: value.courses.some((existing) => existing.id === course.id)
      ? value.courses.map((existing) => existing.id === course.id ? course : existing)
      : [...value.courses, course],
    options: nextOptions,
    intents: value.intents.some((intent) => intent.courseId === course.id)
      ? value.intents.map((intent) => intent.courseId !== course.id ? intent : {
        ...intent,
        requiredSectionIds: cleanIds(intent.requiredSectionIds),
        excludedSectionIds: cleanIds(intent.excludedSectionIds),
        preferredSectionIds: cleanIds(intent.preferredSectionIds),
      })
      : [...value.intents, { courseId: course.id, required: true }],
    registration: {
      present: withoutCourseRegistrationState(value.registration.present, staleOptionIds, staleSectionIds),
      past: value.registration.past.map((state) => withoutCourseRegistrationState(state, staleOptionIds, staleSectionIds)),
    },
  };
}

function withoutCourseRegistrationState(
  state: RegistrationState,
  optionIds: ReadonlySet<string>,
  sectionIds: ReadonlySet<string>,
): RegistrationState {
  return {
    optionStatuses: Object.fromEntries(Object.entries(state.optionStatuses).filter(([id]) => !optionIds.has(id))),
    excludedOptionIds: state.excludedOptionIds.filter((id) => !optionIds.has(id)),
    sectionStatuses: Object.fromEntries(Object.entries(state.sectionStatuses ?? {}).filter(([id]) => !sectionIds.has(id))),
    excludedSectionIds: (state.excludedSectionIds ?? []).filter((id) => !sectionIds.has(id)),
  };
}

/** Removes a course and every persisted option/section outcome that belongs to it. */
export function removeCourseFromPlanner(value: PlannerData, courseId: string): PlannerData {
  const removedOptions = value.options.filter((option) => option.courseId === courseId);
  const optionIds = new Set(removedOptions.map((option) => option.id));
  const sectionIds = new Set(removedOptions.flatMap((option) => option.sectionIds));
  return {
    ...value,
    courses: value.courses.filter((course) => course.id !== courseId),
    intents: value.intents.filter((intent) => intent.courseId !== courseId),
    options: value.options.filter((option) => option.courseId !== courseId),
    registration: {
      present: withoutCourseRegistrationState(value.registration.present, optionIds, sectionIds),
      past: value.registration.past.map((state) => withoutCourseRegistrationState(state, optionIds, sectionIds)),
    },
  };
}

/** Adds schema-v2 defaults without invalidating persisted single-section plans. */
export function normalizePlannerData(value: PlannerData): PlannerData {
  return {
    ...emptyPlannerData,
    ...value,
    schemaVersion: 2,
    term: value.term ?? null,
    intents: (value.intents ?? []).map((intent) => ({
      ...intent,
      requiredSectionIds: intent.requiredSectionIds ?? [],
      excludedSectionIds: intent.excludedSectionIds ?? [],
      preferredSectionIds: intent.preferredSectionIds ?? [],
    })),
    registration: {
      present: {
        optionStatuses: value.registration?.present.optionStatuses ?? {},
        excludedOptionIds: value.registration?.present.excludedOptionIds ?? [],
        sectionStatuses: value.registration?.present.sectionStatuses ?? {},
        excludedSectionIds: value.registration?.present.excludedSectionIds ?? [],
      },
      past: (value.registration?.past ?? []).map((state) => ({
        optionStatuses: state.optionStatuses ?? {},
        excludedOptionIds: state.excludedOptionIds ?? [],
        sectionStatuses: state.sectionStatuses ?? {},
        excludedSectionIds: state.excludedSectionIds ?? [],
      })),
    },
    preferences: {
      ...defaultSchedulePreferences,
      ...(value.preferences ?? {}),
      weights: {
        ...defaultSchedulePreferences.weights,
        ...(value.preferences?.weights ?? {}),
      },
    },
  };
}
