import type { EnrollmentOption } from '../courses/types';
import { meetingsConflict } from '../courses/meetings';

export { meetingsConflict } from '../courses/meetings';

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
