import { describe, expect, it } from 'vitest';
import { buildHighlights } from '../../src/features/highlighting';
import { defaultSettings } from '../../src/features/settings';

describe('course highlights', () => {
  it('uses semantic priorities and names the conflicting course', () => {
    const highlights = buildHighlights({
      meetings: [{ day: 'tuesday', startMinute: 840, endMinute: 915 }],
      location: 'New Bund Campus',
      instructor: 'Professor X',
      prerequisite: 'Data Structures',
      extraFee: '$50 materials fee',
      specialRule: 'Instructor permission required',
      classifications: ['cs-required'],
      degreeLabels: ['CE Required', 'EE Required'],
    }, defaultSettings.highlights, [{
      courseCode: 'ECON-SHU 201',
      meeting: { day: 'tuesday', startMinute: 840, endMinute: 915 },
    }]);
    expect(highlights.find((item) => item.kind === 'instructor')?.priority).toBe('normal');
    expect(highlights.find((item) => item.kind === 'fee')?.priority).toBe('warning');
    expect(highlights.find((item) => item.kind === 'conflict')).toMatchObject({
      priority: 'critical', value: 'ECON-SHU 201 · Tue · 14:00–15:15',
    });
    expect(highlights.find((item) => item.kind === 'degree')?.value).toBe('CS Required');
    expect(highlights.filter((item) => item.kind === 'degree').map((item) => item.value)).toEqual(['CS Required', 'CE Required', 'EE Required']);
  });

  it('omits unavailable provenance fields and disabled categories', () => {
    const highlights = buildHighlights({ meetings: [], classifications: ['unknown'] }, {
      ...defaultSettings.highlights,
      prerequisites: false,
      degreeClassification: false,
    });
    expect(highlights).toEqual([]);
  });
});
