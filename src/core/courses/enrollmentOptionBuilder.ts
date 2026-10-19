import { meetingsConflict } from './meetings';
import type {
  ComponentCompatibilityRule,
  ComponentRequirement,
  EnrollmentComponent,
  EnrollmentOption,
  Instructor,
  RawCourseOffering,
  Section,
  SectionComponentType,
  SectionId,
} from './types';

export interface EnrollmentOptionBuildConstraints {
  readonly requiredSectionIds?: readonly SectionId[];
  readonly excludedSectionIds?: readonly SectionId[];
  readonly sectionStatuses?: Readonly<Record<SectionId, 'available' | 'locked' | 'unavailable' | 'waitlisted'>>;
}

function requirementIsValid(requirement: ComponentRequirement): boolean {
  return Number.isInteger(requirement.min)
    && Number.isInteger(requirement.max)
    && requirement.min >= 0
    && requirement.max >= requirement.min;
}

function combinations<T>(values: readonly T[], count: number): readonly (readonly T[])[] {
  if (count === 0) return [[]];
  if (count > values.length) return [];
  const result: T[][] = [];
  const selected: T[] = [];
  const visit = (start: number): void => {
    if (selected.length === count) {
      result.push([...selected]);
      return;
    }
    const remaining = count - selected.length;
    for (let index = start; index <= values.length - remaining; index += 1) {
      selected.push(values[index]!);
      visit(index + 1);
      selected.pop();
    }
  };
  visit(0);
  return result;
}

function choicesForRequirement(
  sections: readonly Section[],
  requirement: ComponentRequirement,
): readonly (readonly Section[])[] {
  const choices: (readonly Section[])[] = [];
  const upperBound = Math.min(requirement.max, sections.length);
  for (let count = requirement.min; count <= upperBound; count += 1) {
    choices.push(...combinations(sections, count));
  }
  return choices;
}

interface CompatibilityIndex {
  readonly allowedByParent: ReadonlyMap<SectionId, ReadonlySet<SectionId>>;
  readonly childIds: ReadonlySet<SectionId>;
  readonly childComponentTypes: ReadonlySet<SectionComponentType>;
  readonly childTypesByParent: ReadonlyMap<SectionId, ReadonlySet<SectionComponentType>>;
}

function compatibilityIndex(
  rules: readonly ComponentCompatibilityRule[],
  sections: ReadonlyMap<SectionId, Section>,
): CompatibilityIndex {
  const mutable = new Map<SectionId, Set<SectionId>>();
  const childTypesByParent = new Map<SectionId, Set<SectionComponentType>>();
  const childIds = new Set<SectionId>();
  const childComponentTypes = new Set<SectionComponentType>();
  for (const rule of rules) {
    const allowed = mutable.get(rule.parentSectionId) ?? new Set<SectionId>();
    const childTypes = childTypesByParent.get(rule.parentSectionId) ?? new Set<SectionComponentType>();
    for (const childId of rule.allowedChildSectionIds) {
      allowed.add(childId);
      childIds.add(childId);
      const componentType = sections.get(childId)?.componentType;
      if (componentType !== undefined) {
        childComponentTypes.add(componentType);
        childTypes.add(componentType);
      }
    }
    mutable.set(rule.parentSectionId, allowed);
    childTypesByParent.set(rule.parentSectionId, childTypes);
  }
  return { allowedByParent: mutable, childIds, childComponentTypes, childTypesByParent };
}

function isPotentialChild(section: Section, compatibility: CompatibilityIndex): boolean {
  return compatibility.childIds.has(section.id) || compatibility.childComponentTypes.has(section.componentType);
}

function isPotentialChildOf(parentId: SectionId, child: Section, compatibility: CompatibilityIndex): boolean {
  return compatibility.childTypesByParent.get(parentId)?.has(child.componentType) ?? false;
}

/** Rejects incompatible pairs early; child-parent completeness is checked at the leaf. */
function pairwiseCompatible(sections: readonly Section[], compatibility: CompatibilityIndex): boolean {
  for (let left = 0; left < sections.length; left += 1) {
    for (let right = left + 1; right < sections.length; right += 1) {
      const leftSection = sections[left]!;
      const rightSection = sections[right]!;
      const leftId = leftSection.id;
      const rightId = rightSection.id;
      const leftAllowed = compatibility.allowedByParent.get(leftId);
      const rightAllowed = compatibility.allowedByParent.get(rightId);
      if (leftAllowed !== undefined && isPotentialChildOf(leftId, rightSection, compatibility) && !leftAllowed.has(rightId)) return false;
      if (rightAllowed !== undefined && isPotentialChildOf(rightId, leftSection, compatibility) && !rightAllowed.has(leftId)) return false;
    }
  }
  return true;
}

function everyChildHasSelectedParent(sections: readonly Section[], compatibility: CompatibilityIndex): boolean {
  const selectedIds = new Set(sections.map((section) => section.id));
  for (const section of sections) {
    if (!isPotentialChild(section, compatibility)) continue;
    const hasParent = [...compatibility.allowedByParent]
      .some(([parentId, children]) => selectedIds.has(parentId) && children.has(section.id));
    if (!hasParent) return false;
  }
  return true;
}

function hasInternalConflict(sections: readonly Section[]): boolean {
  for (let left = 0; left < sections.length; left += 1) {
    for (let right = left + 1; right < sections.length; right += 1) {
      if (sections[left]!.meetings.some((a) => sections[right]!.meetings.some((b) => meetingsConflict(a, b)))) return true;
    }
  }
  return false;
}

function uniqueInstructors(sections: readonly Section[]): readonly Instructor[] {
  const seen = new Set<string>();
  const result: Instructor[] = [];
  for (const instructor of sections.flatMap((section) => section.instructors ?? [])) {
    const key = `${instructor.id ?? ''}\u0000${instructor.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(instructor);
  }
  return result;
}

function toComponent(section: Section): EnrollmentComponent {
  return {
    sectionId: section.id,
    componentType: section.componentType,
    ...(section.sectionCode === undefined ? {} : { sectionCode: section.sectionCode }),
    ...(section.classNumber === undefined ? {} : { classNumber: section.classNumber }),
    meetings: section.meetings,
    instructors: section.instructors ?? [],
  };
}

function toOption(courseId: string, sections: readonly Section[]): EnrollmentOption {
  const ordered = [...sections].sort((left, right) => left.id.localeCompare(right.id));
  const sectionIds = ordered.map((section) => section.id);
  return {
    id: `${courseId}::${sectionIds.join('+')}`,
    courseId,
    sectionIds,
    components: ordered.map(toComponent),
    meetings: ordered.flatMap((section) => section.meetings),
    instructors: uniqueInstructors(ordered),
  };
}

/**
 * Builds complete legal enrollment units from raw catalog sections. The schedule
 * solver deliberately remains unaware of component types and linkage rules.
 */
export function buildEnrollmentOptions(
  offering: RawCourseOffering,
  constraints: EnrollmentOptionBuildConstraints = {},
): readonly EnrollmentOption[] {
  const requirements = offering.componentRequirements;
  if (requirements.length === 0
    || requirements.some((requirement) => !requirementIsValid(requirement))
    || new Set(requirements.map((requirement) => requirement.componentType)).size !== requirements.length) return [];

  const uniqueSections = new Map<SectionId, Section>();
  for (const section of offering.sections) {
    if (section.courseId === offering.course.id && !uniqueSections.has(section.id)) uniqueSections.set(section.id, section);
  }
  const excluded = new Set(constraints.excludedSectionIds);
  const required = new Set([
    ...(constraints.requiredSectionIds ?? []),
    ...Object.entries(constraints.sectionStatuses ?? {}).flatMap(([id, status]) => status === 'locked' ? [id] : []),
  ]);
  const eligible = [...uniqueSections.values()]
    .filter((section) => !excluded.has(section.id))
    .filter((section) => {
      const status = constraints.sectionStatuses?.[section.id] ?? 'available';
      return status !== 'unavailable' && status !== 'waitlisted';
    })
    .sort((left, right) => left.id.localeCompare(right.id));

  if ([...required].some((id) => !eligible.some((section) => section.id === id))) return [];
  const selectableTypes = requirements.filter((requirement) => requirement.max > 0).map((requirement) => requirement.componentType);
  const compatibilityStatus = offering.compatibilityStatus ?? (offering.compatibilityRules === undefined ? 'unknown' : 'known');
  if (new Set(selectableTypes).size > 1 && compatibilityStatus === 'unknown') return [];

  const compatibility = compatibilityIndex(offering.compatibilityRules ?? [], uniqueSections);
  const choiceGroups = requirements.map((requirement) => choicesForRequirement(
    eligible.filter((section) => section.componentType === requirement.componentType),
    requirement,
  ));
  if (choiceGroups.some((choices) => choices.length === 0)) return [];

  const generated: EnrollmentOption[] = [];
  const selected: Section[] = [];
  const visit = (index: number): void => {
    if (index === choiceGroups.length) {
      const selectedIds = new Set(selected.map((section) => section.id));
      if ([...required].some((id) => !selectedIds.has(id))
        || !everyChildHasSelectedParent(selected, compatibility)
        || hasInternalConflict(selected)) return;
      generated.push(toOption(offering.course.id, selected));
      return;
    }
    for (const choice of choiceGroups[index]!) {
      selected.push(...choice);
      if (pairwiseCompatible(selected, compatibility)) visit(index + 1);
      selected.splice(selected.length - choice.length, choice.length);
    }
  };
  visit(0);
  return generated.sort((left, right) => left.id.localeCompare(right.id));
}
