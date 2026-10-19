import type { ClassificationCurriculum, PrerequisiteRule } from '../../../core/curriculum';

const required = ['CSCI-SHU 101', 'CSCI-SHU 210', 'CSCI-SHU 215', 'CSCI-SHU 220', 'CSCI-SHU 2314'];
const capstone = ['CSCI-SHU 420', 'CSCI-SHU 430'];
const statistics = ['MATH-SHU 235', 'MATH-SHU 238', 'BUSF-SHU 101'];
const systems = ['CENG-SHU 202', 'CSCI-UA 201', 'CSCI-SHU 350'];
const electives = [
  'BUSF-SHU 310', 'CENG-SHU 201', 'CSCI-SHU 188', 'CSCI-SHU 200', 'CSCI-SHU 205', 'CSCI-SHU 213',
  'CSCI-SHU 222', 'CSCI-SHU 254', 'CSCI-SHU 308', 'CSCI-SHU 311', 'CSCI-SHU 350', 'CSCI-SHU 360',
  'CSCI-SHU 361', 'CSCI-SHU 370', 'CSCI-SHU 375', 'CSCI-SHU 376', 'CSCI-SHU 378', 'CSCI-SHU 381',
  'CSCI-SHU 410', 'CSCI-SHU 997', 'DATS-SHU 101', 'DATS-SHU 200', 'DATS-SHU 235', 'DATS-SHU 240',
  'DATS-SHU 369', 'DATS-SHU 377',
];

export const nyushComputerScience: ClassificationCurriculum = {
  id: 'nyush-cs-2026-27',
  name: 'NYU Shanghai Computer Science BS (2026–27 bulletin)',
  requirements: [
    { id: 'cs-required', kind: 'required-course', label: 'Required CS courses', courseIds: required },
    { id: 'cs-capstone', kind: 'choose-n', label: 'Choose one capstone', courseIds: capstone, count: 1 },
    { id: 'cs-statistics', kind: 'choose-n', label: 'Choose one statistics course', courseIds: statistics, count: 1 },
    { id: 'cs-systems', kind: 'choose-n', label: 'Choose one systems course', courseIds: systems, count: 1 },
    { id: 'cs-electives', kind: 'choose-n', label: 'Choose four CS electives', courseIds: electives, count: 4 },
    { id: 'cs-interdisciplinary-limit', kind: 'policy-note', label: 'At most one interdisciplinary CS elective (BUSF-SHU 310)', needsManualVerification: true },
  ],
  classificationByRequirement: {
    'cs-required': 'cs-required', 'cs-capstone': 'cs-required', 'cs-statistics': 'cs-required',
    'cs-systems': 'cs-required', 'cs-electives': 'cs-elective',
  },
};

export const csPrerequisites: readonly PrerequisiteRule[] = [
  { courseId: 'CSCI-SHU 210', allOf: [['CSCI-SHU 101']], manualAlternative: 'Placement or A- in CSCI-SHU 11 may satisfy this prerequisite.' },
  { courseId: 'CSCI-SHU 220', allOf: [['CSCI-SHU 210'], ['CSCI-SHU 2314', 'MATH-SHU 140', 'MATH-SHU 150']] },
  { courseId: 'CSCI-SHU 215', allOf: [['CENG-SHU 202', 'CSCI-UA 201']] },
];
