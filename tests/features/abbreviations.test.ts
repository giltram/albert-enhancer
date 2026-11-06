import { describe, expect, it } from 'vitest';
import { expandAbbreviations, getConfiguredAbbreviations, resolveAbbreviationQuery } from '../../src/features/abbreviations';

describe('abbreviation engine', () => {
  it('expands built-ins only at token boundaries', () => {
    expect(expandAbbreviations('EAP and WAI and LA, but not SCSEAP or CLASS')).toBe(
      'EAP (English for Academic Purposes) and WAI (Writing as Inquiry) and LA (Linear Algebra), but not SCSEAP or CLASS',
    );
  });

  it('lets custom entries override built-ins', () => {
    const entries = getConfiguredAbbreviations({ customAbbreviations: [{ abbreviation: 'wai', expansion: 'Writing and Imagination', enabled: true }] });
    expect(expandAbbreviations('WAI EAP', entries))
      .toBe('WAI (Writing and Imagination) EAP (English for Academic Purposes)');
  });

  it('lets a disabled custom entry suppress its built-in', () => {
    const entries = getConfiguredAbbreviations({ customAbbreviations: [{ abbreviation: 'EAP', expansion: 'Anything', enabled: false }] });
    expect(expandAbbreviations('EAP', entries))
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
    expect(resolveAbbreviationQuery('ICS DL POH IDS ICP GPS LA CS')).toBe(
      'Introduction to Computer Science Digital Logic Perspectives on Humanities Introduction to Data Science Introduction to Computer Programming Global Perspectives on Society Linear Algebra CS',
    );
  });

  it('merges legacy defaults, overrides and additions without duplicate rows', () => {
    const entries = getConfiguredAbbreviations({ customAbbreviations: [
      { abbreviation: ' la ', expansion: 'Custom algebra', enabled: true },
      { abbreviation: 'AI', expansion: 'Artificial Intelligence', enabled: true },
      { abbreviation: ' ', expansion: 'Ignored', enabled: true },
    ] });
    expect(entries.filter((item) => item.abbreviation.trim().toUpperCase() === 'LA')).toHaveLength(1);
    expect(resolveAbbreviationQuery('LA AI GPS', entries)).toBe('Custom algebra Artificial Intelligence Global Perspectives on Society');
  });

  it('uses the saved full list without restoring removed or renamed defaults', () => {
    const entries = getConfiguredAbbreviations({
      abbreviations: [
        { abbreviation: 'ALG', expansion: 'Linear Algebra', enabled: true },
        { abbreviation: 'WAI', expansion: 'Writing as Inquiry', enabled: false },
      ],
      customAbbreviations: [{ abbreviation: 'LA', expansion: 'Legacy algebra', enabled: true }],
    });
    expect(resolveAbbreviationQuery('ALG LA EAP WAI', entries)).toBe('Linear Algebra LA EAP WAI');
    expect(expandAbbreviations('ALG LA EAP WAI', entries)).toBe('ALG (Linear Algebra) LA EAP WAI');
  });

  it('keeps an explicitly empty list empty', () => {
    const entries = getConfiguredAbbreviations({ abbreviations: [], customAbbreviations: [] });
    expect(entries).toEqual([]);
    expect(resolveAbbreviationQuery('LA EAP', entries)).toBe('LA EAP');
  });
});
