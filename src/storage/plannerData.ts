import type { Course, EnrollmentOption } from '../core/courses';
import type { RegistrationHistory } from '../core/registration';
import { emptyRegistrationState } from '../core/registration';
import type { CourseIntent, RegistrationState, SchedulePreferences } from '../core/schedule';
import { defaultSchedulePreferences } from '../core/schedule';

export interface PlannerData {
  readonly schemaVersion: 2;
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
