import { describe, expect, it } from 'vitest';
import { MockCourseDataProvider, NYUCourseDataProvider } from '../../src/adapters/nyu-course-data';

describe('course data providers', () => {
  it('supports deterministic mock search and options', async () => {
    const provider = new MockCourseDataProvider(
      [{ id: 'cs', code: 'CSCI-SHU 220', title: 'Algorithms' }],
      [{ id: 'cs-1', courseId: 'cs', sectionIds: ['001'], instructors: [], meetings: [] }],
    );
    await expect(provider.searchCourses({ query: 'algo' })).resolves.toHaveLength(1);
    await expect(provider.getEnrollmentOptions('cs')).resolves.toHaveLength(1);
  });

  it('strictly decodes injected NYU transport data and drops malformed fields', async () => {
    const payload = { id: 'cs', code: 'CSCI-SHU 220', title: 'Algorithms', options: [{
      id: 'cs-1', sectionIds: ['001'], instructors: [{ name: 'Professor X' }],
      meetings: [{ day: 'tuesday', startMinute: 840, endMinute: 915 }, { day: 'noday', startMinute: 1, endMinute: 2 }],
    }] };
    const provider = new NYUCourseDataProvider({ search: async () => [payload, { bad: true }], course: async () => payload });
    await expect(provider.searchCourses({ query: 'algo' })).resolves.toEqual([{ id: 'cs', code: 'CSCI-SHU 220', title: 'Algorithms' }]);
    const options = await provider.getEnrollmentOptions('cs');
    expect(options[0]?.meetings).toHaveLength(1);
  });

  it('preserves valid normalized component metadata', async () => {
    const payload = { id: 'cs', code: 'CSCI 101', title: 'Programming', options: [{
      id: 'cs::lec1+rec1', sectionIds: ['lec1', 'rec1'], instructors: [], meetings: [],
      components: [{ sectionId: 'lec1', componentType: 'lecture', sectionCode: '001' }, { sectionId: 'rec1', componentType: 'recitation', sectionCode: '011' }],
    }] };
    const provider = new NYUCourseDataProvider({ search: async () => [], course: async () => payload });
    await expect(provider.getEnrollmentOptions('cs')).resolves.toMatchObject([{
      components: [{ sectionId: 'lec1', componentType: 'lecture' }, { sectionId: 'rec1', componentType: 'recitation' }],
    }]);
  });
});
