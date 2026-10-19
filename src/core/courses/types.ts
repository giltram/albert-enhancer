export type CourseId = string;
export type EnrollmentOptionId = string;
export type SectionId = string;

export type SectionComponentType =
  | 'lecture'
  | 'recitation'
  | 'lab'
  | 'seminar'
  | 'workshop'
  | 'discussion'
  | 'other';

export interface Course {
  readonly id: CourseId;
  readonly code: string;
  readonly title: string;
  readonly description?: string;
}

export interface Instructor {
  readonly id?: string;
  readonly name: string;
}

export type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface Meeting {
  readonly day: Weekday;
  /** Minutes after midnight, inclusive. */
  readonly startMinute: number;
  /** Minutes after midnight, exclusive. */
  readonly endMinute: number;
  readonly location?: string;
}

export interface Section {
  readonly id: SectionId;
  readonly courseId: CourseId;
  readonly componentType: SectionComponentType;
  readonly sectionCode?: string;
  readonly classNumber?: string;
  readonly instructors?: readonly Instructor[];
  readonly meetings: readonly Meeting[];
  /** Provider-specific association used while normalizing linked components. */
  readonly associationId?: string;
  /** Explicit catalog linkage when the provider exposes it. */
  readonly linkedSectionIds?: readonly SectionId[];
}

export interface ComponentRequirement {
  readonly componentType: SectionComponentType;
  readonly min: number;
  readonly max: number;
}

/**
 * An exhaustive directed compatibility edge set for one parent section.
 * Multiple rules for the same parent are merged.
 */
export interface ComponentCompatibilityRule {
  readonly parentSectionId: SectionId;
  readonly allowedChildSectionIds: readonly SectionId[];
}

export type CompatibilityStatus = 'known' | 'unknown';

export interface RawCourseOffering {
  readonly course: Course;
  readonly sections: readonly Section[];
  readonly componentRequirements: readonly ComponentRequirement[];
  readonly compatibilityRules?: readonly ComponentCompatibilityRule[];
  /**
   * Defaults to `known` when rules are supplied and `unknown` otherwise.
   * Unknown multi-component offerings intentionally produce no options.
   */
  readonly compatibilityStatus?: CompatibilityStatus;
}

export interface EnrollmentComponent {
  readonly sectionId: SectionId;
  readonly componentType: SectionComponentType;
  /** Denormalized display data keeps persisted options self-contained. */
  readonly sectionCode?: string;
  readonly classNumber?: string;
  readonly meetings?: readonly Meeting[];
  readonly instructors?: readonly Instructor[];
}

/** The atomic choice made by the solver (for example lecture + recitation). */
export interface EnrollmentOption {
  readonly id: EnrollmentOptionId;
  readonly courseId: CourseId;
  readonly sectionIds: readonly string[];
  /** Optional only for compatibility with planner data saved before schema v2. */
  readonly components?: readonly EnrollmentComponent[];
  readonly meetings: readonly Meeting[];
  readonly instructors: readonly Instructor[];
}
