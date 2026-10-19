import { describe, expect, it } from 'vitest';
import type { EnrollmentOption, ScheduleProblem } from '../../src/core';
import { solveSchedules } from '../../src/core/schedule';

const options: EnrollmentOption[] = [
  { id: 'algo-1', courseId: 'algo', sectionIds: ['lec-1', 'rec-1'], instructors: [], meetings: [{ day: 'monday', startMinute: 600, endMinute: 675 }] },
  { id: 'algo-2', courseId: 'algo', sectionIds: ['lec-2', 'rec-2'], instructors: [], meetings: [{ day: 'tuesday', startMinute: 600, endMinute: 675 }] },
  { id: 'econ-1', courseId: 'econ', sectionIds: ['econ-lec'], instructors: [], meetings: [{ day: 'monday', startMinute: 650, endMinute: 725 }] },
  { id: 'econ-2', courseId: 'econ', sectionIds: ['econ-lec-2'], instructors: [], meetings: [{ day: 'wednesday', startMinute: 650, endMinute: 725 }] },
];

const problem: ScheduleProblem = {
  intents: [{ courseId: 'algo', required: true }, { courseId: 'econ', required: true }],
  options,
  registration: { optionStatuses: {}, excludedOptionIds: [] },
};

describe('solveSchedules', () => {
  it('returns only compatible atomic enrollment options', () => {
    expect(solveSchedules(problem).map((candidate) => candidate.id)).toEqual([
      'algo-1|econ-2', 'algo-2|econ-1', 'algo-2|econ-2',
    ]);
  });

  it('honors locked, excluded, unavailable, and waitlisted states', () => {
    expect(solveSchedules({
      ...problem,
      registration: {
        optionStatuses: { 'algo-2': 'locked', 'econ-1': 'waitlisted' },
        excludedOptionIds: ['econ-2'],
      },
    })).toEqual([]);
  });

  it('permits omitting optional courses', () => {
    const schedules = solveSchedules({ ...problem, intents: [{ courseId: 'algo', required: false }] });
    expect(schedules.map((candidate) => candidate.id)).toEqual(['', 'algo-1', 'algo-2']);
  });

  it('composes section requirements and exclusions with exact-option locks', () => {
    const multi: EnrollmentOption[] = [
      { id: 'a-11', courseId: 'a', sectionIds: ['lec1', 'rec1'], instructors: [], meetings: [] },
      { id: 'a-12', courseId: 'a', sectionIds: ['lec1', 'rec2'], instructors: [], meetings: [] },
      { id: 'a-21', courseId: 'a', sectionIds: ['lec2', 'rec3'], instructors: [], meetings: [] },
    ];
    const constrained: ScheduleProblem = {
      intents: [{ courseId: 'a', required: true, requiredSectionIds: ['lec1'], excludedSectionIds: ['rec2'] }],
      options: multi,
      registration: { optionStatuses: { 'a-11': 'locked' }, excludedOptionIds: [] },
    };
    expect(solveSchedules(constrained).map((candidate) => candidate.id)).toEqual(['a-11']);
  });

  it('removes every bundle containing an unavailable parent or child section', () => {
    const multi: EnrollmentOption[] = [
      { id: 'a-11', courseId: 'a', sectionIds: ['lec1', 'rec1'], instructors: [], meetings: [] },
      { id: 'a-12', courseId: 'a', sectionIds: ['lec1', 'rec2'], instructors: [], meetings: [] },
      { id: 'a-21', courseId: 'a', sectionIds: ['lec2', 'rec3'], instructors: [], meetings: [] },
    ];
    const base: ScheduleProblem = { intents: [{ courseId: 'a', required: true }], options: multi, registration: { optionStatuses: {}, excludedOptionIds: [] } };
    expect(solveSchedules({ ...base, registration: { ...base.registration, sectionStatuses: { rec2: 'unavailable' } } }).map((candidate) => candidate.id)).toEqual(['a-11', 'a-21']);
    expect(solveSchedules({ ...base, registration: { ...base.registration, sectionStatuses: { lec1: 'unavailable' } } }).map((candidate) => candidate.id)).toEqual(['a-21']);
  });

  it('makes a locked component select its optional course without locking an exact bundle', () => {
    const multi: EnrollmentOption[] = [
      { id: 'a-11', courseId: 'a', sectionIds: ['lec1', 'rec1'], instructors: [], meetings: [] },
      { id: 'a-12', courseId: 'a', sectionIds: ['lec1', 'rec2'], instructors: [], meetings: [] },
    ];
    const schedules = solveSchedules({
      intents: [{ courseId: 'a', required: false }],
      options: multi,
      registration: { optionStatuses: {}, excludedOptionIds: [], sectionStatuses: { lec1: 'locked' } },
    });
    expect(schedules.map((candidate) => candidate.id)).toEqual(['a-11', 'a-12']);
  });
});
