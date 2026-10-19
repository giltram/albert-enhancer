import { selectPreferredCampus } from '../../features/campus';
import type { CampusPreference } from '../../features/settings';
import { ALBERT_SELECTORS } from './selectors';

export function applyCampusPreference(root: ParentNode, preference: CampusPreference): boolean {
  const select = root.querySelector<HTMLSelectElement>(ALBERT_SELECTORS.campusSelect);
  if (select === null) return false;
  const options = [...select.options].map((option) => ({
    value: option.value,
    label: option.textContent?.trim() ?? '',
    disabled: option.disabled,
  }));
  const nextValue = selectPreferredCampus(options, select.value, preference);
  if (nextValue === undefined) return false;
  select.value = nextValue;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function collectCampusOptions(root: ParentNode): readonly { value: string; label: string }[] {
  const select = root.querySelector<HTMLSelectElement>(ALBERT_SELECTORS.campusSelect);
  if (select === null) return [];
  return [...select.options]
    .filter((option) => option.value.length > 0 && !option.disabled)
    .map((option) => ({ value: option.value, label: option.textContent?.trim() || option.value }));
}
