import type { CustomAbbreviation } from '../settings/types';

export const builtInAbbreviations: Readonly<Record<string, string>> = {
  EAP: 'English for Academic Purposes',
  WAI: 'Writing as Inquiry',
  ICS: 'Introduction to Computer Science',
  DL: 'Digital Logic',
  POH: 'Perspectives on Humanities',
  IDS: 'Introduction to Data Science',
  ICP: 'Introduction to Computer Programming',
  GPS: 'Global Perspectives on Society',
};

function normalizedKey(value: string): string {
  return value.trim().toLocaleUpperCase('en-US');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function abbreviationDictionary(
  custom: readonly CustomAbbreviation[],
): ReadonlyMap<string, string | undefined> {
  const result = new Map<string, string | undefined>(Object.entries(builtInAbbreviations));
  for (const item of custom) {
    const key = normalizedKey(item.abbreviation);
    if (key.length === 0) continue;
    result.set(key, item.enabled && item.expansion.trim().length > 0 ? item.expansion.trim() : undefined);
  }
  return result;
}

/** Expands complete tokens only and leaves substrings inside ordinary words alone. */
export function expandAbbreviations(text: string, custom: readonly CustomAbbreviation[] = []): string {
  let result = text;
  for (const [abbreviation, expansion] of abbreviationDictionary(custom)) {
    if (expansion === undefined) continue;
    const token = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(abbreviation)}(?![\\p{L}\\p{N}_])`, 'giu');
    result = result.replace(token, (match) => `${match} (${expansion})`);
  }
  return result;
}

/** Replaces abbreviation tokens with the words Albert can actually search for. */
export function resolveAbbreviationQuery(text: string, custom: readonly CustomAbbreviation[] = []): string {
  let result = text;
  for (const [abbreviation, expansion] of abbreviationDictionary(custom)) {
    if (expansion === undefined) continue;
    const token = new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(abbreviation)}(?![\\p{L}\\p{N}_])`, 'giu');
    result = result.replace(token, expansion);
  }
  return result;
}
