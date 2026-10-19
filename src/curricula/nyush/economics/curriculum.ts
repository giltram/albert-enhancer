import type { ClassificationCurriculum } from '../../../core/curriculum';

const required = ['ECON-SHU 1', 'ECON-SHU 251', 'ECON-SHU 3', 'ECON-SHU 10', 'ECON-SHU 202', 'ECON-SHU 301', 'MATH-SHU 235', 'BUSF-SHU 101'];
const advanced = ['ECON-SHU 210', 'ECON-SHU 217', 'ECON-SHU 225', 'ECON-SHU 315', 'ECON-SHU 336', 'ECON-SHU 402', 'ECON-SHU 416'];
const electives = [
  'BPEP-SHU 9042', 'ECON-SHU 151', 'ECON-SHU 208', 'ECON-SHU 216', 'ECON-SHU 218', 'ECON-SHU 219',
  'ECON-SHU 221', 'ECON-SHU 222', 'ECON-SHU 232', 'ECON-SHU 238', 'ECON-SHU 239', 'ECON-SHU 255',
  'ECON-SHU 335', 'ECON-SHU 342', 'ECON-SHU 351', 'ECON-SHU 353', 'ECON-SHU 356', 'ECON-SHU 360',
  'ECON-SHU 368', 'ECON-SHU 997', 'MATH-SHU 160', ...advanced,
];

export const nyushEconomics: ClassificationCurriculum = {
  id: 'nyush-economics-2026-27',
  name: 'NYU Shanghai Economics BA (2026–27 bulletin)',
  requirements: [
    { id: 'econ-required', kind: 'required-course', label: 'Economics required-course pool', courseIds: required, needsManualVerification: true },
    { id: 'econ-electives', kind: 'minimum-credits', label: 'Economics electives', courseIds: electives, credits: 24 },
    { id: 'econ-advanced', kind: 'minimum-credits', label: 'Advanced economics electives', courseIds: advanced, credits: 8 },
    { id: 'econ-capstone', kind: 'choose-n', label: 'Economics capstone or honors seminar', courseIds: ['ECON-SHU 400', 'ECON-SHU 453', 'BUSF-SHU 3'], count: 1 },
    { id: 'econ-attribution', kind: 'policy-note', label: 'Final double-count attribution needs advisor verification', needsManualVerification: true },
  ],
  classificationByRequirement: {
    'econ-required': 'economics-required', 'econ-electives': 'economics-elective',
    'econ-advanced': 'economics-elective', 'econ-capstone': 'economics-required',
  },
};
