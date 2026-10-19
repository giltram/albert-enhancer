import type { CourseClassification } from '../../core/curriculum';
import type { Meeting } from '../../core/courses';

export type HighlightPriority = 'normal' | 'important' | 'warning' | 'critical';
export type HighlightKind = 'time' | 'location' | 'instructor' | 'prerequisite' | 'fee' | 'rule' | 'conflict' | 'degree';

export interface Highlight {
  readonly kind: HighlightKind;
  readonly label: string;
  readonly value: string;
  readonly priority: HighlightPriority;
}

export interface CourseInformation {
  readonly meetings: readonly Meeting[];
  readonly location?: string;
  readonly instructor?: string;
  readonly prerequisite?: string;
  readonly extraFee?: string;
  readonly specialRule?: string;
  readonly classifications: readonly CourseClassification[];
  /** Exact requirement labels sourced from Albert's Fulfillment description. */
  readonly degreeLabels?: readonly string[];
}

export interface ScheduleConflict {
  readonly courseCode: string;
  readonly meeting: Meeting;
}
