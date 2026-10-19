import type { Course, EnrollmentComponent, EnrollmentOption, Instructor, Meeting, SectionComponentType, Weekday } from '../../core/courses';
import type { CourseDataProvider, CourseSearchQuery } from './types';

export interface NYUCourseRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly description?: string;
  readonly options?: readonly {
    readonly id: string;
    readonly sectionIds: readonly string[];
    readonly components?: readonly EnrollmentComponent[];
    readonly instructors: readonly Instructor[];
    readonly meetings: readonly Meeting[];
  }[];
}

/** Transport is injectable because NYU does not document a stable public JSON API. */
export interface NYUDataTransport {
  search(query: CourseSearchQuery): Promise<unknown>;
  course(courseId: string): Promise<unknown>;
}

const weekdays = new Set<Weekday>(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']);
const componentTypes = new Set<SectionComponentType>(['lecture', 'recitation', 'lab', 'seminar', 'workshop', 'discussion', 'other']);
function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function meeting(value: unknown): Meeting | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.day !== 'string' || !weekdays.has(candidate.day as Weekday)
    || typeof candidate.startMinute !== 'number' || typeof candidate.endMinute !== 'number'
    || candidate.startMinute < 0 || candidate.endMinute <= candidate.startMinute || candidate.endMinute > 1440) return undefined;
  return { day: candidate.day as Weekday, startMinute: candidate.startMinute, endMinute: candidate.endMinute, ...(typeof candidate.location === 'string' ? { location: candidate.location } : {}) };
}
function component(value: unknown): EnrollmentComponent | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.sectionId !== 'string' || typeof candidate.componentType !== 'string'
    || !componentTypes.has(candidate.componentType as SectionComponentType)) return undefined;
  const meetings = Array.isArray(candidate.meetings) ? candidate.meetings.map(meeting).filter((item): item is Meeting => item !== undefined) : undefined;
  const instructors = Array.isArray(candidate.instructors) ? candidate.instructors.flatMap((item) => typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).name === 'string' ? [{ name: (item as Record<string, unknown>).name as string }] : []) : undefined;
  return {
    sectionId: candidate.sectionId,
    componentType: candidate.componentType as SectionComponentType,
    ...(typeof candidate.sectionCode === 'string' ? { sectionCode: candidate.sectionCode } : {}),
    ...(typeof candidate.classNumber === 'string' ? { classNumber: candidate.classNumber } : {}),
    ...(meetings === undefined ? {} : { meetings }),
    ...(instructors === undefined ? {} : { instructors }),
  };
}
function decodeRecord(value: unknown): NYUCourseRecord | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.code !== 'string' || typeof record.title !== 'string') return undefined;
  const decodedOptions = Array.isArray(record.options) ? record.options.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const option = raw as Record<string, unknown>;
    if (typeof option.id !== 'string' || !isStringArray(option.sectionIds)) return [];
    const meetings = Array.isArray(option.meetings) ? option.meetings.map(meeting).filter((item): item is Meeting => item !== undefined) : [];
    const instructors = Array.isArray(option.instructors) ? option.instructors.flatMap((item) => typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).name === 'string' ? [{ name: (item as Record<string, unknown>).name as string }] : []) : [];
    const components = Array.isArray(option.components) ? option.components.map(component).filter((item): item is EnrollmentComponent => item !== undefined) : undefined;
    return [{ id: option.id, sectionIds: option.sectionIds, meetings, instructors, ...(components === undefined ? {} : { components }) }];
  }) : [];
  return { id: record.id, code: record.code, title: record.title, ...(typeof record.description === 'string' ? { description: record.description } : {}), options: decodedOptions };
}

function toCourse(record: NYUCourseRecord): Course {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    ...(record.description === undefined ? {} : { description: record.description }),
  };
}

export class NYUCourseDataProvider implements CourseDataProvider {
  public constructor(private readonly transport: NYUDataTransport) {}
  public async searchCourses(query: CourseSearchQuery): Promise<readonly Course[]> {
    const payload = await this.transport.search(query);
    if (!Array.isArray(payload)) return [];
    return payload.map(decodeRecord).filter((item): item is NYUCourseRecord => item !== undefined).map(toCourse);
  }
  public async getCourse(courseId: string): Promise<Course | undefined> {
    const decoded = decodeRecord(await this.transport.course(courseId));
    if (decoded === undefined) return undefined;
    return toCourse(decoded);
  }
  public async getEnrollmentOptions(courseId: string): Promise<readonly EnrollmentOption[]> {
    const decoded = decodeRecord(await this.transport.course(courseId));
    return decoded?.options?.map((option) => ({ ...option, courseId })) ?? [];
  }
}
