import { describe, expect, it } from 'vitest';
import { expandAbbreviations, resolveAbbreviationQuery } from '../../src/features/abbreviations';

describe('abbreviation engine', () => {
  it('expands built-ins only at token boundaries', () => {
    expect(expandAbbreviations('EAP and WAI, but not SCSEAP')).toBe(
      'EAP (English for Academic Purposes) and WAI (Writing as Inquiry), but not SCSEAP',
    );
  });

  it('lets custom entries override built-ins', () => {
    expect(expandAbbreviations('WAI', [{ abbreviation: 'wai', expansion: 'Writing and Imagination', enabled: true }]))
      .toBe('WAI (Writing and Imagination)');
  });

  it('lets a disabled custom entry suppress its built-in', () => {
    expect(expandAbbreviations('EAP', [{ abbreviation: 'EAP', expansion: 'Anything', enabled: false }]))
      .toBe('EAP');
  });

  it('resolves built-in search queries without regard to letter case', () => {
    expect(resolveAbbreviationQuery('wai WAI WaI')).toBe(
      'Writing as Inquiry Writing as Inquiry Writing as Inquiry',
    );
  });

  it('resolves custom search queries without regard to letter case', () => {
    const custom = [{ abbreviation: 'PoH', expansion: 'Perspectives on the Humanities', enabled: true }];
    expect(resolveAbbreviationQuery('poh or POH', custom)).toBe(
      'Perspectives on the Humanities or Perspectives on the Humanities',
    );
  });

  it('ships the requested NYU Shanghai course-title defaults without CS', () => {
    expect(resolveAbbreviationQuery('ICS DL POH IDS ICP GPS CS')).toBe(
      'Introduction to Computer Science Digital Logic Perspectives on Humanities Introduction to Data Science Introduction to Computer Programming Global Perspectives on Society CS',
    );
  });
});
