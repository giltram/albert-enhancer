import type { CourseId, EnrollmentOption } from '../courses/types';
import { optionsConflict } from './conflicts';

export interface ConflictPair {
  readonly leftOptionId: string;
  readonly rightOptionId: string;
}

export interface CourseConflict {
  readonly leftCourseId: CourseId;
  readonly rightCourseId: CourseId;
  readonly conflictingPairs: readonly ConflictPair[];
  readonly pairCount: number;
  readonly ratio: number;
}

export function analyzeCourseConflict(
  leftCourseId: CourseId,
  rightCourseId: CourseId,
  options: readonly EnrollmentOption[],
): CourseConflict {
  const left = options.filter((option) => option.courseId === leftCourseId);
  const right = options.filter((option) => option.courseId === rightCourseId);
  const conflictingPairs: ConflictPair[] = [];
  for (const leftOption of left) {
    for (const rightOption of right) {
      if (optionsConflict(leftOption, rightOption)) {
        conflictingPairs.push({ leftOptionId: leftOption.id, rightOptionId: rightOption.id });
      }
    }
  }
  const pairCount = left.length * right.length;
  return {
    leftCourseId,
    rightCourseId,
    conflictingPairs,
    pairCount,
    ratio: pairCount === 0 ? 0 : conflictingPairs.length / pairCount,
  };
}
