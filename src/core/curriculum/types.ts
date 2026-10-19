import type { CourseId } from '../courses/types';

export type RequirementKind = 'required-course' | 'choose-n' | 'minimum-credits' | 'policy-note';

export interface Requirement {
  readonly id: string;
  readonly kind: RequirementKind;
  readonly label: string;
  readonly courseIds?: readonly CourseId[];
  readonly count?: number;
  readonly credits?: number;
  readonly needsManualVerification?: boolean;
}

export interface Curriculum {
  readonly id: string;
  readonly name: string;
  readonly requirements: readonly Requirement[];
}

export type CourseClassification =
  | 'cs-required'
  | 'cs-elective'
  | 'economics-required'
  | 'economics-elective'
  | 'core'
  | 'free-elective'
  | 'unknown';
