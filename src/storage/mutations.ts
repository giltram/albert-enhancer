import type { Course, EnrollmentOption } from '../core/courses';
import type { CourseProgress, DegreePlanEntry } from '../core/curriculum';
import type { RegistrationEvent } from '../core/registration';
import { transition, undo } from '../core/registration';
import type { CourseIntent } from '../core/schedule';
import { mergeEnrollmentOptions, removeCourseFromPlanner } from './plannerData';
import type { PlannerData } from './plannerData';

type SectionField = 'preferredSectionIds' | 'requiredSectionIds' | 'excludedSectionIds';
export type PlannerMutation =
  | { type: 'import'; course: Course; primarySectionId: string; sectionIds: readonly string[]; options: readonly EnrollmentOption[]; term: string }
  | { type: 'remove'; courseId: string }
  | { type: 'required'; courseId: string; required: boolean }
  | { type: 'section'; courseId: string; field: SectionField; sectionId: string; active: boolean }
  | { type: 'reset-sections'; courseId: string }
  | { type: 'registration'; event: RegistrationEvent }
  | { type: 'undo' }
  | { type: 'avoid-friday'; value: boolean }
  | { type: 'avoid-early'; value: boolean };
export type DegreeMutation =
  | { type: 'add'; entry: DegreePlanEntry }
  | { type: 'remove'; courseId: string }
  | { type: 'progress'; courseId: string; progress: CourseProgress };

function changeSection(intent: CourseIntent, change: Extract<PlannerMutation, { type: 'section' }>): CourseIntent {
  const ids = (intent[change.field] ?? []).filter((id) => id !== change.sectionId);
  if (change.active) ids.push(change.sectionId);
  const updated = { ...intent, [change.field]: ids.sort() };
  if (!change.active) return updated;
  const without = (field: SectionField) => (intent[field] ?? []).filter((id) => id !== change.sectionId);
  if (change.field === 'requiredSectionIds') return { ...updated, excludedSectionIds: without('excludedSectionIds') };
  if (change.field === 'excludedSectionIds') return { ...updated, requiredSectionIds: without('requiredSectionIds'), preferredSectionIds: without('preferredSectionIds') };
  return updated;
}

/** Commands apply to the latest stored value, never a caller's stale snapshot. */
export function applyPlannerMutation(data: PlannerData, change: PlannerMutation): PlannerData {
  switch (change.type) {
    case 'import': return mergeEnrollmentOptions(data, change.course, change.primarySectionId, change.sectionIds, change.options, change.term);
    case 'remove': return removeCourseFromPlanner(data, change.courseId);
    case 'required': return { ...data, intents: data.intents.map((intent) => intent.courseId === change.courseId ? { ...intent, required: change.required } : intent) };
    case 'section': return { ...data, intents: data.intents.map((intent) => intent.courseId === change.courseId ? changeSection(intent, change) : intent) };
    case 'reset-sections': return { ...data, intents: data.intents.map((intent) => intent.courseId === change.courseId ? { ...intent, requiredSectionIds: [], excludedSectionIds: [], preferredSectionIds: [] } : intent) };
    case 'registration': {
      const event = change.event;
      if ('optionId' in event && !data.options.some((option) => option.id === event.optionId)) return data;
      if ('sectionId' in event && !data.options.some((option) => option.sectionIds.includes(event.sectionId))) return data;
      return { ...data, registration: transition(data.registration, event) };
    }
    case 'undo': return { ...data, registration: undo(data.registration) };
    case 'avoid-friday': return { ...data, preferences: { ...data.preferences, avoidFriday: change.value } };
    case 'avoid-early': {
      const preferences = { ...data.preferences };
      if (change.value) return { ...data, preferences: { ...preferences, avoidBeforeMinute: 600 } };
      delete preferences.avoidBeforeMinute;
      return { ...data, preferences };
    }
  }
}
export function applyDegreeMutation(entries: readonly DegreePlanEntry[], change: DegreeMutation): readonly DegreePlanEntry[] {
  switch (change.type) {
    case 'add': return entries.some((entry) => entry.courseId === change.entry.courseId) ? entries : [...entries, change.entry];
    case 'remove': return entries.filter((entry) => entry.courseId !== change.courseId);
    case 'progress': return entries.map((entry) => entry.courseId === change.courseId ? { ...entry, progress: change.progress } : entry);
  }
}
