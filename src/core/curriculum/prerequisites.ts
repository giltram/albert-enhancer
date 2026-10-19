import type { CourseId } from '../courses/types';

export type CourseProgress = 'taken' | 'in-progress' | 'planned';
export interface AcademicHistoryEntry { readonly courseId: CourseId; readonly progress: CourseProgress }
export interface PrerequisiteRule {
  readonly courseId: CourseId;
  /** Each inner group is OR; all groups are required. */
  readonly allOf: readonly (readonly CourseId[])[];
  readonly manualAlternative?: string;
}
export interface PrerequisiteResult {
  readonly satisfied: boolean;
  readonly missingGroups: readonly (readonly CourseId[])[];
  readonly needsManualVerification: boolean;
}

export function evaluatePrerequisites(rule: PrerequisiteRule, history: readonly AcademicHistoryEntry[]): PrerequisiteResult {
  const completed = new Set(history.filter((entry) => entry.progress === 'taken').map((entry) => entry.courseId));
  const missingGroups = rule.allOf.filter((group) => !group.some((courseId) => completed.has(courseId)));
  return {
    satisfied: missingGroups.length === 0,
    missingGroups,
    needsManualVerification: missingGroups.length > 0 && rule.manualAlternative !== undefined,
  };
}
