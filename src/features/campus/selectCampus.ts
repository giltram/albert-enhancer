import type { CampusPreference } from '../settings/types';

export interface CampusOption {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
}

/** Returns a new value only when the exact saved Albert option is present. */
export function selectPreferredCampus(
  options: readonly CampusOption[],
  currentValue: string,
  preference: CampusPreference,
): string | undefined {
  if (!preference.enabled || preference.preferredValue === undefined) return undefined;
  const match = options.find((option) => option.value === preference.preferredValue && !option.disabled);
  if (match === undefined || match.value === currentValue) return undefined;
  return match.value;
}
