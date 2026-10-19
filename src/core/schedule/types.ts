import type { CourseId, EnrollmentOption, EnrollmentOptionId, SectionId } from '../courses/types';

export interface CourseIntent {
  readonly courseId: CourseId;
  readonly required: boolean;
  /** Omit to allow every option belonging to the course. */
  readonly optionIds?: readonly EnrollmentOptionId[];
  /** Component constraints do not lock one exact EnrollmentOption. */
  readonly requiredSectionIds?: readonly SectionId[];
  readonly excludedSectionIds?: readonly SectionId[];
  /** Soft preferences used by ranking; they never change feasibility. */
  readonly preferredSectionIds?: readonly SectionId[];
}

export type OptionStatus = 'available' | 'locked' | 'unavailable' | 'waitlisted';

export interface RegistrationState {
  readonly optionStatuses: Readonly<Record<EnrollmentOptionId, OptionStatus>>;
  readonly excludedOptionIds: readonly EnrollmentOptionId[];
  /** Optional for compatibility with planner state saved before schema v2. */
  readonly sectionStatuses?: Readonly<Record<SectionId, OptionStatus>>;
  readonly excludedSectionIds?: readonly SectionId[];
}

export interface ScheduleCandidate {
  readonly id: string;
  readonly options: readonly EnrollmentOption[];
}

export interface ScheduleProblem {
  readonly intents: readonly CourseIntent[];
  readonly options: readonly EnrollmentOption[];
  readonly registration: RegistrationState;
}
