import { ALBERT_SELECTORS } from './selectors';

function termLabel(value: string | null | undefined): string | undefined {
  const labels = [...(value ?? '').matchAll(/\b(Spring|Summer|Fall|Winter|January)\s+(20\d{2})\b/gi)]
    .map((match) => `${match[1]!.toLowerCase()} ${match[2]}`);
  const terms = new Set(labels);
  return terms.size === 1 ? [...terms][0] : undefined;
}

/** Read explicit source labels only. Missing or ambiguous semester stays unknown. */
export function readOfferingTerm(root: Element): string | undefined {
  const explicit = root.closest('[data-ae-term]')?.getAttribute('data-ae-term');
  if (explicit !== undefined && explicit !== null) return termLabel(explicit);
  const list = root.closest(ALBERT_SELECTORS.loggedSectionList);
  const local = list?.querySelector('[data-ae-field="term"], h1, h2, h3');
  if (local !== undefined && local !== null) return termLabel(local.textContent);
  const labels = [...root.ownerDocument.querySelectorAll('h1, [data-ae-field="term"], select[id*="STRM" i] option:checked, select[id*="term" i] option:checked')]
    .map((node) => termLabel(node.textContent)).filter((value): value is string => value !== undefined);
  const terms = new Set(labels);
  return terms.size === 1 ? [...terms][0] : undefined;
}
