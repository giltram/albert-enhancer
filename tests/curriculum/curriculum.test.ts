import { describe, expect, it } from 'vitest';
import { classifyCourse, evaluatePrerequisites } from '../../src/core/curriculum';
import { csPrerequisites, nyushComputerScience, nyushEconomics } from '../../src/curricula/nyush';

describe('NYUSH CS + Economics curriculum', () => {
  it('shows every possible supported classification without choosing attribution', () => {
    expect(classifyCourse('BUSF-SHU 101', [nyushComputerScience, nyushEconomics])).toEqual(['cs-required', 'economics-required']);
  });

  it('returns Unknown rather than guessing', () => {
    expect(classifyCourse('ART-SHU 999', [nyushComputerScience, nyushEconomics])).toEqual(['unknown']);
  });

  it('accepts Algorithms prerequisites in a synthetic academic history', () => {
    const rule = csPrerequisites.find((item) => item.courseId === 'CSCI-SHU 220')!;
    expect(evaluatePrerequisites(rule, [
      { courseId: 'CSCI-SHU 210', progress: 'taken' },
      { courseId: 'CSCI-SHU 2314', progress: 'taken' },
    ])).toMatchObject({ satisfied: true, missingGroups: [] });
  });

  it('warns when Data Structures is missing', () => {
    const rule = csPrerequisites.find((item) => item.courseId === 'CSCI-SHU 220')!;
    expect(evaluatePrerequisites(rule, [{ courseId: 'CSCI-SHU 2314', progress: 'taken' }])).toMatchObject({
      satisfied: false, missingGroups: [['CSCI-SHU 210']],
    });
  });
});
