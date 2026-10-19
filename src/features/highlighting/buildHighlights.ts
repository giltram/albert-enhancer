import type { HighlightSettings } from '../settings/types';
import type { CourseInformation, Highlight, ScheduleConflict } from './types';

const classificationLabels = {
  'cs-required': 'CS Required',
  'cs-elective': 'CS Elective',
  'economics-required': 'Economics Required',
  'economics-elective': 'Economics Elective',
  core: 'Core',
  'free-elective': 'Free Elective',
  unknown: 'Unknown',
} as const;

function minutes(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function meetingText(meeting: CourseInformation['meetings'][number]): string {
  const day = meeting.day.slice(0, 3);
  return `${day[0]!.toUpperCase()}${day.slice(1)} · ${minutes(meeting.startMinute)}–${minutes(meeting.endMinute)}`;
}

export function buildHighlights(
  information: CourseInformation,
  settings: HighlightSettings,
  conflicts: readonly ScheduleConflict[] = [],
): readonly Highlight[] {
  const highlights: Highlight[] = [];
  if (settings.time && information.meetings.length > 0) {
    highlights.push({ kind: 'time', label: 'TIME', value: information.meetings.map(meetingText).join(' · '), priority: 'normal' });
  }
  if (settings.location && information.location !== undefined) {
    highlights.push({ kind: 'location', label: 'LOCATION', value: information.location, priority: 'normal' });
  }
  if (settings.instructor && information.instructor !== undefined) {
    highlights.push({ kind: 'instructor', label: 'INSTRUCTOR', value: information.instructor, priority: 'normal' });
  }
  if (settings.prerequisites && information.prerequisite !== undefined) {
    highlights.push({ kind: 'prerequisite', label: 'PREREQUISITE', value: information.prerequisite, priority: 'important' });
  }
  if (settings.extraFees && information.extraFee !== undefined) {
    highlights.push({ kind: 'fee', label: 'FEE', value: information.extraFee, priority: 'warning' });
  }
  if (settings.specialRules && information.specialRule !== undefined) {
    highlights.push({ kind: 'rule', label: 'RULE', value: information.specialRule, priority: 'warning' });
  }
  if (settings.conflicts) {
    for (const conflict of conflicts) {
      highlights.push({ kind: 'conflict', label: 'CONFLICT', value: `${conflict.courseCode} · ${meetingText(conflict.meeting)}`, priority: 'critical' });
    }
  }
  if (settings.degreeClassification) {
    const labels = new Set<string>(information.classifications.map((classification) => classificationLabels[classification]));
    for (const label of information.degreeLabels ?? []) labels.add(label);
    labels.delete('Unknown');
    for (const label of labels) {
      highlights.push({ kind: 'degree', label: 'DEGREE', value: label, priority: 'important' });
    }
  }
  return highlights;
}
