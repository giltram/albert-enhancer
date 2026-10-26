import { updatePlanner } from '../../storage/commands';
import { hasComponentFilters, optionsForSectionGroup, readSectionGroup } from './sectionGroups';
import { chooseAuxiliarySections } from './sectionPicker';

export async function importSectionGroup(root: Element, trigger: HTMLElement): Promise<boolean> {
  if (hasComponentFilters(root)) throw new Error('Clear class filters before adding so all linked recitation / lab options are visible.');
  const group = readSectionGroup(root);
  if (group === undefined) throw new Error('Could not read the linked sections. Refresh the search and try again.');
  const allIds = group.choices.flatMap((choice) => choice.sections.map((child) => child.section.id));
  const selectedIds = group.choices.some((choice) => choice.sections.length > 1)
    ? await chooseAuxiliarySections(group, trigger)
    : allIds;
  if (selectedIds === undefined) return false;
  if (!root.isConnected || hasComponentFilters(root) || JSON.stringify(readSectionGroup(root)) !== JSON.stringify(group)) {
    throw new Error('Search results changed. Add the lecture again from the current results.');
  }
  const options = optionsForSectionGroup(group, selectedIds);
  if (options.length === 0) throw new Error('These sections have no compatible combination. Keep at least one non-overlapping option of each required type.');
  if (group.primary.term === undefined) throw new Error('Could not identify this semester. Select a semester and refresh the search before importing.');
  await updatePlanner({ type: 'import', course: group.primary.course, primarySectionId: group.primary.section.id,
    sectionIds: [group.primary.section.id, ...allIds], options, term: group.primary.term });
  return true;
}
