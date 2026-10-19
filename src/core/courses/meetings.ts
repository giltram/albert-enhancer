import type { Meeting } from './types';

/** Meeting intervals are half-open: adjacent classes do not overlap. */
export function meetingsConflict(left: Meeting, right: Meeting): boolean {
  return left.day === right.day
    && left.startMinute < right.endMinute
    && right.startMinute < left.endMinute;
}
