import { ALBERT_SELECTORS } from './selectors';
import { albertSelectTermEvent } from './searchBridge';

const appliedPreferences = new WeakMap<Element, string>();

function normalizeTerm(label: string): string {
  return label.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
}

/** Apply once per rendered semester group, so later manual tab changes are preserved. */
export function applyTermPreference(root: ParentNode, preferredTerm?: string): boolean {
  const tabs = [...root.querySelectorAll<HTMLAnchorElement>(ALBERT_SELECTORS.semesterTab)];
  const preferred = normalizeTerm(preferredTerm ?? '');
  if (preferred.length === 0) {
    for (const tab of tabs) {
      if (tab.parentElement !== null) appliedPreferences.delete(tab.parentElement);
    }
    return false;
  }
  const matches = tabs.filter((tab) => normalizeTerm(tab.textContent ?? '') === preferred);
  if (matches.length !== 1) return false;
  const tab = matches[0];
  if (tab === undefined) return false;
  const group = tab.parentElement;
  if (group === null || appliedPreferences.get(group) === preferred) return false;
  if (tab.closest('[hidden], [inert], [aria-hidden="true"]') !== null || tab.getAttribute('aria-disabled') === 'true') return false;
  // Remember before dispatch: Albert updates the DOM and can trigger enhancement again.
  appliedPreferences.set(group, preferred);
  if (tab.classList.contains('selected')) return false;
  // MAIN acknowledges a successful call by cancelling this fixed request event.
  // Never click Albert's javascript: link from the isolated extension world.
  const request = new Event(albertSelectTermEvent, { bubbles: true, cancelable: true });
  tab.dispatchEvent(request);
  if (request.defaultPrevented) return true;
  appliedPreferences.delete(group);
  return false;
}
