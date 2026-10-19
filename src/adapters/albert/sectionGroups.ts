import { buildEnrollmentOptions } from '../../core/courses';
import type { EnrollmentOption } from '../../core/courses';
import { parseCourse } from './courseParser';
import type { ParsedAlbertCourse } from './courseParser';
import { ALBERT_SELECTORS } from './selectors';

export type AuxiliaryType = 'recitation' | 'lab';

export interface AuxiliaryChoices {
  readonly componentType: AuxiliaryType;
  readonly sections: readonly ParsedAlbertCourse[];
}

export interface AlbertSectionGroup {
  readonly primary: ParsedAlbertCourse;
  readonly choices: readonly AuxiliaryChoices[];
}

export function isAuxiliary(type: string): type is AuxiliaryType {
  return type === 'recitation' || type === 'lab';
}

/**
 * Albert's per-term list places each primary before its linked REC/LAB rows.
 * A new non-auxiliary Component ends the block. Never use teacher or row index
 * to classify a section, and never cross course/term scrollarea boundaries.
 */
export function readSectionGroup(root: Element): AlbertSectionGroup | undefined {
  const primary = parseCourse(root);
  if (primary === undefined || isAuxiliary(primary.section.componentType)) return undefined;
  const list = root.closest(ALBERT_SELECTORS.loggedSectionList);
  if (list === null) return { primary, choices: [] };
  const roots = [...list.querySelectorAll(ALBERT_SELECTORS.courseRoot)];
  const start = roots.indexOf(root);
  if (start === -1) return undefined;
  const auxiliaries: ParsedAlbertCourse[] = [];
  for (const childRoot of roots.slice(start + 1)) {
    const child = parseCourse(childRoot);
    // An unreadable row is a boundary, not permission to guess past it.
    if (child === undefined) return undefined;
    if (child.course.id !== primary.course.id || !isAuxiliary(child.section.componentType)) break;
    auxiliaries.push(child);
  }
  return {
    primary,
    choices: (['recitation', 'lab'] as const).flatMap((componentType) => {
      const sections = auxiliaries.filter((child) => child.section.componentType === componentType);
      return sections.length === 0 ? [] : [{ componentType, sections }];
    }),
  };
}

/** Hidden rows make the ordered-block association incomplete. */
export function hasComponentFilters(root: Element): boolean {
  if (!root.id.startsWith('win0divNYU_CLS_DTL_CLASS_NBR$')) return false;
  const selects = root.ownerDocument.querySelectorAll<HTMLSelectElement>('select');
  return [...selects].some((select) => {
    if (!/^(?:NYU_CLS_WRK_(?:SSR_COMPONENT|ENRL_STAT|NYU_UNIT)|NYU_CLS_WRK2_DESCR50|NYU_CLS_WRK_DESCRFORMAL)/.test(select.id)
      && !/classes only\?/i.test(select.getAttribute('aria-label') ?? select.labels?.[0]?.textContent ?? '')) return false;
    const label = select.selectedOptions[0]?.textContent?.trim() ?? '';
    return label !== '' && !/^(?:No|Show All|No Results)$/i.test(label);
  });
}

/** Each retained child is an alternative; builder selects exactly one per type. */
export function optionsForSectionGroup(
  group: AlbertSectionGroup,
  selectedIds: readonly string[],
): readonly EnrollmentOption[] {
  const { primary, choices } = group;
  const selected = new Set(selectedIds);
  const children = choices.flatMap((choice) => choice.sections.filter((child) => selected.has(child.section.id)));
  if (choices.some((choice) => !choice.sections.some((child) => selected.has(child.section.id)))) return [];
  const options = buildEnrollmentOptions({
    course: primary.course,
    sections: [primary.section, ...children.map((child) => child.section)],
    componentRequirements: [primary.section.componentType, ...choices.map((choice) => choice.componentType)]
      .map((componentType) => ({ componentType, min: 1, max: 1 })),
    compatibilityStatus: 'known',
    compatibilityRules: [{ parentSectionId: primary.section.id, allowedChildSectionIds: children.map((child) => child.section.id) }],
  });
  // Preserve IDs for existing single-component plans.
  return choices.length === 0 ? options.map((option) => ({ ...option, id: primary.section.id })) : options;
}
