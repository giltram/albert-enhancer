import type { Course, EnrollmentComponent } from '../../core/courses';

/** Older imports can store the course code inside the title as well as in code. */
export function calendarCourseTitle(course: Pick<Course, 'code' | 'title'>): string {
  const title = course.title.replace(/\s+/g, ' ').trim();
  const code = course.code.replace(/\s+/g, ' ').trim();
  if (code.length === 0) return title;
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const name = new RegExp(`^${escapedCode}(?:\\s*[:–—]\\s*|\\s+)(.+)$`, 'i').exec(title)?.[1]?.trim();
  return name || title;
}

export interface CalendarCourseColor {
  readonly border: string;
  readonly background: string;
}

/** Use all saved courses in insertion order, so changing candidate plans keeps their colors. */
export function calendarCourseColors(courseIds: readonly string[]): ReadonlyMap<string, CalendarCourseColor> {
  const colors = new Map<string, CalendarCourseColor>();
  for (const courseId of courseIds) {
    if (colors.has(courseId)) continue;
    // Space successive courses around the color wheel without repeating a fixed palette.
    const hue = (270 + colors.size * 137.508) % 360;
    colors.set(courseId, {
      border: `hsl(${hue} 48% 36%)`,
      background: `hsl(${hue} 65% 92%)`,
    });
  }
  return colors;
}

export function plannerComponentLabel(component: EnrollmentComponent): string {
  if (component.sectionCode === undefined) return component.sectionId;
  if (component.componentType === 'other') return component.sectionCode;
  const abbreviation = component.componentType === 'recitation' ? 'reci' : component.componentType.slice(0, 3);
  return `${abbreviation} ${component.sectionCode}`;
}
