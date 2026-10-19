import { describe, expect, it } from 'vitest';
import { dependencyWarnings, evaluateCurriculum } from '../../src/core/curriculum';
import { csPrerequisites, nyushComputerScience } from '../../src/curricula/nyush';

describe('degree planner', () => {
  it('estimates requirement coverage without counting future plans as completed', () => {
    const coverage = evaluateCurriculum(nyushComputerScience, [
      { courseId: 'CSCI-SHU 101', progress: 'taken', credits: 4 },
      { courseId: 'CSCI-SHU 210', progress: 'in-progress', credits: 4 },
      { courseId: 'CSCI-SHU 220', progress: 'planned', credits: 4, term: 'Spring 2028' },
    ]);
    expect(coverage.find((item) => item.requirementId === 'cs-required')).toMatchObject({ completed: 2, needed: 5, satisfied: false });
  });

  it('warns about an unmet dependency for a planned course', () => {
    expect(dependencyWarnings([
      { courseId: 'CSCI-SHU 220', progress: 'planned', credits: 4, term: 'Spring 2028' },
      { courseId: 'CSCI-SHU 2314', progress: 'taken', credits: 4 },
    ], csPrerequisites)).toMatchObject([{ courseId: 'CSCI-SHU 220', result: { satisfied: false } }]);
  });
});
