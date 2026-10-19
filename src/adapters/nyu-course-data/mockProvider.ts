import type { Course, EnrollmentOption } from '../../core/courses';
import type { CourseDataProvider, CourseSearchQuery } from './types';

export class MockCourseDataProvider implements CourseDataProvider {
  public constructor(
    private readonly courses: readonly Course[],
    private readonly options: readonly EnrollmentOption[],
  ) {}

  public async searchCourses(query: CourseSearchQuery): Promise<readonly Course[]> {
    const needle = query.query.trim().toLocaleLowerCase('en-US');
    return this.courses.filter((course) => `${course.code} ${course.title}`.toLocaleLowerCase('en-US').includes(needle));
  }

  public async getCourse(courseId: string): Promise<Course | undefined> {
    return this.courses.find((course) => course.id === courseId);
  }

  public async getEnrollmentOptions(courseId: string): Promise<readonly EnrollmentOption[]> {
    return this.options.filter((option) => option.courseId === courseId);
  }
}
