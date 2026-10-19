import type { Curriculum, Requirement } from './types';
import type { AcademicHistoryEntry, CourseProgress, PrerequisiteResult, PrerequisiteRule } from './prerequisites';
import { evaluatePrerequisites } from './prerequisites';

export interface DegreePlanEntry extends AcademicHistoryEntry {
  readonly title?: string;
  readonly credits: number;
  readonly term?: string;
}

export interface RequirementCoverage {
  readonly requirementId: string;
  readonly label: string;
  readonly completed: number;
  readonly needed: number;
  readonly unit: 'courses' | 'credits' | 'manual';
  readonly satisfied: boolean;
  readonly needsManualVerification: boolean;
}

function activeEntries(entries: readonly DegreePlanEntry[]): readonly DegreePlanEntry[] {
  return entries.filter((entry) => entry.progress !== 'planned');
}

function coverageFor(requirement: Requirement, entries: readonly DegreePlanEntry[]): RequirementCoverage {
  const allowed = new Set(requirement.courseIds ?? []);
  const matching = activeEntries(entries).filter((entry) => allowed.has(entry.courseId));
  if (requirement.kind === 'policy-note') {
    return { requirementId: requirement.id, label: requirement.label, completed: 0, needed: 0, unit: 'manual', satisfied: false, needsManualVerification: true };
  }
  if (requirement.kind === 'minimum-credits') {
    const completed = matching.reduce((sum, entry) => sum + entry.credits, 0);
    const needed = requirement.credits ?? 0;
    return { requirementId: requirement.id, label: requirement.label, completed, needed, unit: 'credits', satisfied: completed >= needed, needsManualVerification: requirement.needsManualVerification ?? false };
  }
  const needed = requirement.kind === 'choose-n' ? requirement.count ?? 0 : allowed.size;
  const completed = new Set(matching.map((entry) => entry.courseId)).size;
  return { requirementId: requirement.id, label: requirement.label, completed, needed, unit: 'courses', satisfied: completed >= needed, needsManualVerification: requirement.needsManualVerification ?? false };
}

export function evaluateCurriculum(curriculum: Curriculum, entries: readonly DegreePlanEntry[]): readonly RequirementCoverage[] {
  return curriculum.requirements.map((requirement) => coverageFor(requirement, entries));
}

export interface CourseDependencyWarning {
  readonly courseId: string;
  readonly result: PrerequisiteResult;
}

export function dependencyWarnings(entries: readonly DegreePlanEntry[], rules: readonly PrerequisiteRule[]): readonly CourseDependencyWarning[] {
  return entries.flatMap((entry) => {
    if (entry.progress === 'taken') return [];
    const rule = rules.find((candidate) => candidate.courseId === entry.courseId);
    if (rule === undefined) return [];
    const result = evaluatePrerequisites(rule, entries);
    return result.satisfied ? [] : [{ courseId: entry.courseId, result }];
  });
}

export const degreeProgressColumns: readonly CourseProgress[] = ['taken', 'in-progress', 'planned'];
