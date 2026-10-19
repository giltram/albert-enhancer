import type { Course, EnrollmentOption } from '../../core/courses';

export interface CourseSearchQuery {
  readonly term?: string;
  readonly query: string;
  readonly campus?: string;
}

export interface CourseDataProvider {
  searchCourses(query: CourseSearchQuery): Promise<readonly Course[]>;
  getCourse(courseId: string): Promise<Course | undefined>;
  getEnrollmentOptions(courseId: string): Promise<readonly EnrollmentOption[]>;
}
