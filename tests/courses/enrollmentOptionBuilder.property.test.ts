import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildEnrollmentOptions, meetingsConflict } from '../../src/core';
import type { RawCourseOffering, Section } from '../../src/core';

const linkedOfferingArbitrary = fc.integer({ min: 1, max: 5 }).chain((lectureCount) =>
  fc.array(fc.integer({ min: 1, max: 4 }), { minLength: lectureCount, maxLength: lectureCount }).map((recitationCounts): RawCourseOffering => {
    const sections: Section[] = [];
    const rules: { parentSectionId: string; allowedChildSectionIds: string[] }[] = [];
    for (let lecture = 0; lecture < lectureCount; lecture += 1) {
      const lectureId = `lec${lecture}`;
      sections.push({ id: lectureId, courseId: 'course', componentType: 'lecture', meetings: [{ day: 'monday', startMinute: 480 + lecture * 60, endMinute: 530 + lecture * 60 }] });
      const recitations = Array.from({ length: recitationCounts[lecture]! }, (_, index) => `rec${lecture}-${index}`);
      rules.push({ parentSectionId: lectureId, allowedChildSectionIds: recitations });
      for (let recitation = 0; recitation < recitations.length; recitation += 1) {
        sections.push({ id: recitations[recitation]!, courseId: 'course', componentType: 'recitation', meetings: [{ day: 'friday', startMinute: 480 + recitation * 60, endMinute: 530 + recitation * 60 }] });
      }
    }
    return {
      course: { id: 'course', code: 'C 1', title: 'Course' },
      sections,
      componentRequirements: [{ componentType: 'lecture', min: 1, max: 1 }, { componentType: 'recitation', min: 1, max: 1 }],
      compatibilityRules: rules,
    };
  }),
);

describe('enrollment option builder properties', () => {
  it('always emits complete, linked, conflict-free, unique, deterministic options', () => {
    fc.assert(fc.property(linkedOfferingArbitrary, fc.array(fc.string(), { maxLength: 3 }), (offering, excluded) => {
      const options = buildEnrollmentOptions(offering, { excludedSectionIds: excluded });
      const reversed = buildEnrollmentOptions({ ...offering, sections: [...offering.sections].reverse() }, { excludedSectionIds: excluded });
      expect(options).toEqual(reversed);
      expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
      for (const option of options) {
        expect(option.components?.filter((component) => component.componentType === 'lecture')).toHaveLength(1);
        expect(option.components?.filter((component) => component.componentType === 'recitation')).toHaveLength(1);
        expect(option.sectionIds.every((id) => !excluded.includes(id))).toBe(true);
        const lecture = option.components?.find((component) => component.componentType === 'lecture')?.sectionId;
        const recitation = option.components?.find((component) => component.componentType === 'recitation')?.sectionId;
        expect(offering.compatibilityRules?.find((rule) => rule.parentSectionId === lecture)?.allowedChildSectionIds).toContain(recitation);
        expect(option.meetings.every((left, index) => option.meetings.slice(index + 1).every((right) => !meetingsConflict(left, right)))).toBe(true);
      }
    }), { numRuns: 200 });
  });
});
