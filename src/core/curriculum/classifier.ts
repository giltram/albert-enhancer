import type { CourseClassification, Curriculum } from './types';

export interface ClassificationCurriculum extends Curriculum {
  readonly classificationByRequirement: Readonly<Record<string, CourseClassification>>;
}

export function classifyCourse(courseId: string, curricula: readonly ClassificationCurriculum[]): readonly CourseClassification[] {
  const classifications = new Set<CourseClassification>();
  for (const curriculum of curricula) {
    for (const requirement of curriculum.requirements) {
      if (requirement.courseIds?.includes(courseId) ?? false) {
        classifications.add(curriculum.classificationByRequirement[requirement.id] ?? 'unknown');
      }
    }
  }
  return classifications.size === 0 ? ['unknown'] : [...classifications].sort();
}
