import type { EnrollmentOption, Meeting } from '../courses/types';

export function meetingsConflict(left: Meeting, right: Meeting): boolean {
  return left.day === right.day
    && left.startMinute < right.endMinute
    && right.startMinute < left.endMinute;
}

export function optionsConflict(left: EnrollmentOption, right: EnrollmentOption): boolean {
  return left.meetings.some((a) => right.meetings.some((b) => meetingsConflict(a, b)));
}

export function scheduleHasConflict(options: readonly EnrollmentOption[]): boolean {
  for (let left = 0; left < options.length; left += 1) {
    for (let right = left + 1; right < options.length; right += 1) {
      if (optionsConflict(options[left]!, options[right]!)) return true;
    }
  }
  return false;
}
