import { describe, expect, it } from 'vitest';
import { buildEnrollmentOptions } from '../../src/core/courses';
import type { ComponentCompatibilityRule, RawCourseOffering, Section, SectionComponentType } from '../../src/core/courses';

const course = { id: 'cs101', code: 'CSCI 101', title: 'Programming' };

function section(
  id: string,
  componentType: SectionComponentType,
  day: Section['meetings'][number]['day'] = 'monday',
  startMinute = 600,
): Section {
  return {
    id,
    courseId: course.id,
    componentType,
    sectionCode: id.replace(/^[a-z]+/, ''),
    meetings: [{ day, startMinute, endMinute: startMinute + 50 }],
    instructors: [{ name: id.startsWith('lec') ? 'Professor A' : `Instructor ${id}` }],
  };
}

function offering(
  sections: readonly Section[],
  types: readonly SectionComponentType[],
  compatibilityRules?: readonly ComponentCompatibilityRule[],
): RawCourseOffering {
  return {
    course,
    sections,
    componentRequirements: types.map((componentType) => ({ componentType, min: 1, max: 1 })),
    ...(compatibilityRules === undefined ? {} : { compatibilityRules }),
    ...(types.length > 1 && compatibilityRules === undefined ? { compatibilityStatus: 'known' as const } : {}),
  };
}

describe('enrollment option builder', () => {
  it('preserves the simple lecture-only behavior', () => {
    const options = buildEnrollmentOptions(offering([
      section('lec001', 'lecture'),
      section('lec002', 'lecture', 'tuesday'),
    ], ['lecture']));
    expect(options.map((option) => option.sectionIds)).toEqual([['lec001'], ['lec002']]);
  });

  it('builds only linked lecture and recitation pairs', () => {
    const sections = [section('lec001', 'lecture'), section('lec002', 'lecture', 'tuesday'),
      section('rec011', 'recitation', 'friday'), section('rec012', 'recitation', 'friday', 720),
      section('rec021', 'recitation', 'wednesday'), section('rec022', 'recitation', 'wednesday', 720)];
    const options = buildEnrollmentOptions(offering(sections, ['lecture', 'recitation'], [
      { parentSectionId: 'lec001', allowedChildSectionIds: ['rec011', 'rec012'] },
      { parentSectionId: 'lec002', allowedChildSectionIds: ['rec021', 'rec022'] },
    ]));
    expect(options.map((option) => option.sectionIds)).toEqual([
      ['lec001', 'rec011'], ['lec001', 'rec012'], ['lec002', 'rec021'], ['lec002', 'rec022'],
    ]);
  });

  it('treats known compatibility rules as exhaustive for their child component type', () => {
    const options = buildEnrollmentOptions(offering([
      section('lec1', 'lecture'), section('rec1', 'recitation', 'friday'), section('rec-unlinked', 'recitation', 'friday', 720),
    ], ['lecture', 'recitation'], [{ parentSectionId: 'lec1', allowedChildSectionIds: ['rec1'] }]));
    expect(options.map((option) => option.sectionIds)).toEqual([['lec1', 'rec1']]);
  });

  it('supports linked lecture and lab combinations', () => {
    const options = buildEnrollmentOptions(offering([
      section('lab001', 'lab', 'friday'), section('lab002', 'lab', 'thursday'),
      section('lec001', 'lecture'), section('lec002', 'lecture', 'tuesday'),
    ], ['lecture', 'lab'], [
      { parentSectionId: 'lec001', allowedChildSectionIds: ['lab001'] },
      { parentSectionId: 'lec002', allowedChildSectionIds: ['lab002'] },
    ]));
    expect(options.map((option) => option.sectionIds)).toEqual([
      ['lab001', 'lec001'], ['lab002', 'lec002'],
    ]);
  });

  it('supports three-level lecture, recitation, and lab constraints', () => {
    const sections = [
      section('lab1', 'lab', 'thursday'), section('lab2', 'lab', 'thursday', 720),
      section('lec1', 'lecture'), section('lec2', 'lecture', 'tuesday'),
      section('rec1', 'recitation', 'friday'), section('rec2', 'recitation', 'friday', 720),
    ];
    const options = buildEnrollmentOptions(offering(sections, ['lecture', 'recitation', 'lab'], [
      { parentSectionId: 'lec1', allowedChildSectionIds: ['rec1', 'lab1'] },
      { parentSectionId: 'lec2', allowedChildSectionIds: ['rec2', 'lab2'] },
      { parentSectionId: 'rec1', allowedChildSectionIds: ['lab1'] },
      { parentSectionId: 'rec2', allowedChildSectionIds: ['lab2'] },
    ]));
    expect(options.map((option) => option.sectionIds)).toEqual([
      ['lab1', 'lec1', 'rec1'], ['lab2', 'lec2', 'rec2'],
    ]);
  });

  it('rejects a bundle whose own components overlap', () => {
    const options = buildEnrollmentOptions(offering([
      section('lec1', 'lecture', 'monday', 600), section('rec1', 'recitation', 'monday', 630),
    ], ['lecture', 'recitation'], [{ parentSectionId: 'lec1', allowedChildSectionIds: ['rec1'] }]));
    expect(options).toEqual([]);
  });

  it('generates omission and selection for an optional component', () => {
    const raw: RawCourseOffering = {
      course,
      sections: [section('lec1', 'lecture'), section('work1', 'workshop', 'friday')],
      componentRequirements: [
        { componentType: 'lecture', min: 1, max: 1 },
        { componentType: 'workshop', min: 0, max: 1 },
      ],
      compatibilityStatus: 'known',
    };
    expect(buildEnrollmentOptions(raw).map((option) => option.sectionIds)).toEqual([
      ['lec1'], ['lec1', 'work1'],
    ]);
  });

  it('does not emit incomplete required combinations', () => {
    expect(buildEnrollmentOptions(offering([section('lec1', 'lecture')], ['lecture', 'recitation']))).toEqual([]);
  });

  it('uses deterministic IDs, ordering, merged meetings, and deduplicated instructors', () => {
    const rules = [{ parentSectionId: 'lec1', allowedChildSectionIds: ['rec1'] }];
    const sections = [section('lec1', 'lecture'), { ...section('rec1', 'recitation', 'friday'), instructors: [{ name: 'Professor A' }] }];
    const first = buildEnrollmentOptions(offering(sections, ['lecture', 'recitation'], rules));
    const reversed = buildEnrollmentOptions(offering([...sections].reverse(), ['recitation', 'lecture'], rules));
    expect(first).toEqual(reversed);
    expect(first[0]).toMatchObject({ id: 'cs101::lec1+rec1', sectionIds: ['lec1', 'rec1'] });
    expect(first[0]?.meetings).toHaveLength(2);
    expect(first[0]?.instructors).toEqual([{ name: 'Professor A' }]);
  });

  it('applies required, excluded, and unavailable component constraints', () => {
    const raw = offering([
      section('lec1', 'lecture'), section('lec2', 'lecture', 'tuesday'),
      section('rec1', 'recitation', 'friday'), section('rec2', 'recitation', 'friday', 720),
    ], ['lecture', 'recitation']);
    expect(buildEnrollmentOptions(raw, { requiredSectionIds: ['lec1'], excludedSectionIds: ['rec2'] })
      .map((option) => option.sectionIds)).toEqual([['lec1', 'rec1']]);
    expect(buildEnrollmentOptions(raw, { sectionStatuses: { rec1: 'unavailable' } })
      .every((option) => !option.sectionIds.includes('rec1'))).toBe(true);
  });

  it('fails safely when multi-component compatibility is unknown', () => {
    const raw: RawCourseOffering = {
      course,
      sections: [section('lec1', 'lecture'), section('rec1', 'recitation', 'friday')],
      componentRequirements: [{ componentType: 'lecture', min: 1, max: 1 }, { componentType: 'recitation', min: 1, max: 1 }],
      compatibilityStatus: 'unknown',
    };
    expect(buildEnrollmentOptions(raw)).toEqual([]);
  });
});
