import type { ClassificationCurriculum } from '../../../core/curriculum';
import { nyushComputerScience } from '../cs/curriculum';
import { nyushEconomics } from '../economics/curriculum';

export const nyushCsEconomics: ClassificationCurriculum = {
  id: 'nyush-cs-economics-2026-27',
  name: 'NYU Shanghai CS + Economics planning view (2026–27)',
  requirements: [
    ...nyushComputerScience.requirements,
    ...nyushEconomics.requirements,
    { id: 'cs-econ-double-count', kind: 'policy-note', label: 'Potential double-counts are shown but final attribution requires advisor verification', needsManualVerification: true },
  ],
  classificationByRequirement: {
    ...nyushComputerScience.classificationByRequirement,
    ...nyushEconomics.classificationByRequirement,
  },
};
