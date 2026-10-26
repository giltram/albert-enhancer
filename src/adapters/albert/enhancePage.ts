import type { EnrollmentOption } from '../../core/courses';
import { classifyCourse } from '../../core/curriculum';
import { optionsConflict } from '../../core/schedule';
import type { ScheduleSearchResult } from '../../core/schedule';
import { nyushComputerScience, nyushEconomics } from '../../curricula/nyush';
import { expandAbbreviations, resolveAbbreviationQuery } from '../../features/abbreviations';
import { buildHighlights } from '../../features/highlighting';
import type { AlbertEnhancerSettings } from '../../features/settings';
import type { PlannerData } from '../../storage/planner';
import { applyCampusPreference } from './campusAdapter';
import { parseCourse } from './courseParser';
import { importSectionGroup } from './plannerImport';
import { isAuxiliary, optionsForSectionGroup, readSectionGroup } from './sectionGroups';
import { albertDescriptionSearchEvent, albertTitleSearchEvent } from './searchBridge';
import { ALBERT_SELECTORS } from './selectors';
import { applyTermPreference } from './termAdapter';
import { ensureHomeToolbar } from './homeToolbar';

interface EnhancementContext {
  settings: AlbertEnhancerSettings;
  readonly controller: AbortController;
  readonly searchElements: Set<HTMLElement>;
}
const contexts = new WeakMap<ParentNode, EnhancementContext>();

export function disposeAlbertPage(root: ParentNode): void {
  const context = contexts.get(root);
  context?.controller.abort();
  for (const element of context?.searchElements ?? []) delete element.dataset.aeAbbreviationSearch;
  contexts.delete(root);
  for (const panel of root.querySelectorAll('[data-ae-enhancement]')) panel.remove();
  for (const title of root.querySelectorAll<HTMLElement>('[data-ae-original-text]')) {
    title.textContent = title.dataset.aeOriginalText ?? '';
    delete title.dataset.aeOriginalText;
  }
  applyTermPreference(root, '');
}

function highlightNode(kind: string, label: string, value: string, priority: string): HTMLElement {
  const item = document.createElement('div');
  item.className = `ae-highlight ae-highlight--${priority}`;
  item.dataset.kind = kind;
  const heading = document.createElement('strong');
  heading.textContent = label;
  const content = document.createElement('span');
  content.textContent = value;
  item.append(heading, content);
  return item;
}

function conflictsForCourse(parsedOption: EnrollmentOption, planner: PlannerData | undefined, preview: ScheduleSearchResult | undefined) {
  if (planner === undefined || preview === undefined) return [];
  return (preview.schedules[0]?.options ?? []).flatMap((option) => {
    if (option.courseId === parsedOption.courseId || !optionsConflict(parsedOption, option)) return [];
    const courseCode = planner.courses.find((course) => course.id === option.courseId)?.code ?? option.courseId;
    const meeting = option.meetings.find((otherMeeting) => parsedOption.meetings.some((meeting) => meeting.day === otherMeeting.day && meeting.startMinute < otherMeeting.endMinute && otherMeeting.startMinute < meeting.endMinute));
    return meeting === undefined ? [] : [{ courseCode, meeting }];
  });
}

function enhanceCourse(root: Element, settings: AlbertEnhancerSettings, planner: PlannerData | undefined, preview: ScheduleSearchResult | undefined): void {
  if (root.querySelector(':scope > [data-ae-enhancement]') !== null) return;
  const parsed = parseCourse(root);
  if (parsed === undefined) return;

  const publicTitle = root.querySelector(ALBERT_SELECTORS.courseTitle);
  const title = publicTitle ?? root.closest(ALBERT_SELECTORS.loggedCourseRoot)?.querySelector(ALBERT_SELECTORS.loggedCourseHeading);
  if (title instanceof HTMLElement && title.textContent !== null) {
    const original = title.dataset.aeOriginalText ?? title.textContent;
    title.dataset.aeOriginalText = original;
    if (!settings.abbreviationExpansion) title.textContent = original;
    else if (publicTitle !== null) title.textContent = expandAbbreviations(original, settings.customAbbreviations);
    else {
      const originalTitle = original.replace(/\s+/g, ' ').trim().replace(new RegExp(`^${parsed.course.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i'), '');
      title.textContent = `${parsed.course.code} ${expandAbbreviations(originalTitle, settings.customAbbreviations)}`;
    }
  }

  const panel = document.createElement('aside');
  panel.dataset.aeEnhancement = '';
  panel.className = 'ae-panel';
  const option: EnrollmentOption = {
    id: parsed.section.id,
    courseId: parsed.course.id,
    sectionIds: [parsed.section.id],
    components: [{
      sectionId: parsed.section.id,
      componentType: parsed.section.componentType,
      ...(parsed.section.sectionCode === undefined ? {} : { sectionCode: parsed.section.sectionCode }),
      meetings: parsed.section.meetings,
      instructors: parsed.section.instructors ?? [],
    }],
    meetings: parsed.section.meetings,
    instructors: parsed.section.instructors ?? [],
  };
  const information = {
    ...parsed.information,
    classifications: classifyCourse(parsed.course.code.toLocaleUpperCase('en-US'), [nyushComputerScience, nyushEconomics]),
  };
  for (const highlight of buildHighlights(information, settings.highlights, settings.highlights.conflicts && parsed.term === planner?.term ? conflictsForCourse(option, planner, preview) : [])) {
    const node = highlightNode(highlight.kind, highlight.label, highlight.value, highlight.priority);
    if (highlight.kind === 'conflict' && preview?.complete === false) {
      node.title = 'Conflict with a preview plan. Search is incomplete; other plans may avoid it.';
    }
    panel.append(node);
  }

  const actions = document.createElement('div');
  actions.className = 'ae-actions';
  if (!isAuxiliary(parsed.section.componentType)) {
    const group = readSectionGroup(root);
    const auxiliaryIds = group?.choices.flatMap((choice) => choice.sections.map((child) => child.section.id)) ?? [];
    const expected = group === undefined ? [] : optionsForSectionGroup(group, auxiliaryIds);
    const alreadyAdded = parsed.term !== undefined && parsed.term === planner?.term && expected.some((option) => planner?.options.some((existing) => existing.id === option.id));
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = alreadyAdded ? 'Added' : 'Add to Schedule Lab';
    add.disabled = alreadyAdded;
    const message = document.createElement('p');
    message.className = 'ae-import-message';
    message.setAttribute('role', 'status');
    if (group !== undefined && group.choices.length > 0) {
      message.textContent = group.choices.map((choice) => `${choice.sections.length} ${choice.componentType} option${choice.sections.length === 1 ? '' : 's'}`).join(' · ')
        + ' included with this lecture';
    }
    if (!alreadyAdded) add.addEventListener('click', () => {
      add.disabled = true;
      void importSectionGroup(root, add).then((added) => {
        add.textContent = added ? 'Added' : 'Add to Schedule Lab';
        add.disabled = added;
        if (!added && add.isConnected) add.focus();
      }).catch((error: unknown) => {
        message.textContent = error instanceof Error ? error.message : 'Could not save. Please try again.';
        add.disabled = false;
        if (add.isConnected) add.focus();
      });
    });
    actions.append(add);
    panel.append(message);
  }
  panel.append(actions);
  root.append(panel);
}

function ensureCourseSearchToolbar(root: ParentNode, settings: AlbertEnhancerSettings): void {
  if (root.querySelector(ALBERT_SELECTORS.campusSelect) === null || root.querySelector('[data-ae-toolbar]') !== null) return;
  const host = root.querySelector('#win0divNYU_CLASS_SEARCH') ?? root.querySelector('#NYU_CLS_SRCH') ?? root.querySelector(ALBERT_SELECTORS.campusSelect)?.parentElement;
  if (host === null || host === undefined) return;
  const toolbar = document.createElement('aside');
  toolbar.dataset.aeEnhancement = '';
  toolbar.dataset.aeToolbar = '';
  toolbar.className = 'ae-toolbar';
  const label = document.createElement('strong');
  label.textContent = 'Albert Enhancer';
  const version = document.createElement('small');
  version.className = 'ae-version';
  version.textContent = `v${browser.runtime.getManifest().version}`;
  const state = document.createElement('span');
  state.textContent = settings.campus.enabled && settings.campus.preferredValue !== undefined
    ? `Auto School: ${settings.campus.preferredValue}`
    : 'Auto School: Off';
  const lab = document.createElement('button');
  lab.type = 'button';
  lab.textContent = 'Open Schedule Lab';
  lab.addEventListener('click', () => { void browser.runtime.sendMessage({ type: 'open-schedule-lab' }); });
  const options = document.createElement('button');
  options.type = 'button';
  options.textContent = 'School & abbreviation settings';
  options.addEventListener('click', () => { void browser.runtime.sendMessage({ type: 'open-settings' }); });
  toolbar.append(label, version, state, lab, options);
  host.prepend(toolbar);
}

function ensureSearchResultScrollRoom(root: ParentNode): void {
  const results = root.querySelector('#win0divRESULTS');
  if (results === null || results.querySelector(':scope > [data-ae-results-end-spacer]') !== null) return;
  const spacer = document.createElement('div');
  spacer.dataset.aeEnhancement = '';
  spacer.dataset.aeResultsEndSpacer = '';
  spacer.className = 'ae-results-end-spacer';
  spacer.setAttribute('aria-hidden', 'true');
  results.append(spacer);
}

function resolveSearchInput(input: HTMLInputElement, settings: AlbertEnhancerSettings): void {
  if (settings === undefined || !settings.enabled || !settings.abbreviationExpansion) return;
  const resolved = resolveAbbreviationQuery(input.value, settings.customAbbreviations);
  if (resolved === input.value) return;
  input.value = resolved;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function searchEventForInput(input: HTMLInputElement): string | undefined {
  if (input.id === 'NYU_CLS_DERIVED_DESCR100') return albertTitleSearchEvent;
  if (input.id === 'NYU_CLS_DERIVED_DESCR100_JOB_POST1') return albertDescriptionSearchEvent;
  return undefined;
}

function ensureAbbreviationSearch(root: ParentNode, context: EnhancementContext): void {
  const queries = [...root.querySelectorAll<HTMLInputElement>(ALBERT_SELECTORS.courseSearchQuery)];
  for (const input of queries) {
    if (input.dataset.aeAbbreviationSearch === 'true') continue;
    input.dataset.aeAbbreviationSearch = 'true';
    context.searchElements.add(input);
    input.addEventListener('keydown', (event) => {
      if (!context.settings.enabled || event.key !== 'Enter' || event.isComposing) return;
      const searchEvent = searchEventForInput(input);
      if (searchEvent === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      resolveSearchInput(input, context.settings);
      input.ownerDocument.dispatchEvent(new Event(searchEvent));
    }, { capture: true, signal: context.controller.signal });
  }
  for (const submit of root.querySelectorAll<HTMLElement>(ALBERT_SELECTORS.courseSearchSubmit)) {
    if (submit.dataset.aeAbbreviationSearch === 'true') continue;
    submit.dataset.aeAbbreviationSearch = 'true';
    context.searchElements.add(submit);
    submit.addEventListener('click', () => {
      const inputId = submit.id === 'BUTTON_SMALL'
        ? 'NYU_CLS_DERIVED_DESCR100'
        : submit.id === 'SMALL_BUTTON' ? 'NYU_CLS_DERIVED_DESCR100_JOB_POST1' : undefined;
      if (inputId !== undefined) {
        const input = root.querySelector<HTMLInputElement>(`#${inputId}`);
        if (input !== null) resolveSearchInput(input, context.settings);
        return;
      }
      const container = submit.closest('[data-ae-search]') ?? root;
      for (const input of container.querySelectorAll<HTMLInputElement>(ALBERT_SELECTORS.courseSearchQuery)) resolveSearchInput(input, context.settings);
    }, { capture: true, signal: context.controller.signal });
  }
}

export function enhanceAlbertPage(root: ParentNode, settings: AlbertEnhancerSettings, planner?: PlannerData, preview?: ScheduleSearchResult): void {
  if (!settings.enabled) { disposeAlbertPage(root); return; }
  let context = contexts.get(root);
  if (context === undefined) {
    context = { settings, controller: new AbortController(), searchElements: new Set() };
    contexts.set(root, context);
  }
  context.settings = settings;
  ensureHomeToolbar(root, {
    openScheduleLab: () => { void browser.runtime.sendMessage({ type: 'open-schedule-lab' }); },
    openDegreePlanner: () => { void browser.runtime.sendMessage({ type: 'open-degree-planner' }); },
    openSettings: () => { void browser.runtime.sendMessage({ type: 'open-settings' }); },
  });
  applyTermPreference(root, settings.preferredTerm);
  applyCampusPreference(root, settings.campus);
  ensureAbbreviationSearch(root, context);
  ensureCourseSearchToolbar(root, settings);
  for (const courseRoot of root.querySelectorAll(ALBERT_SELECTORS.courseRoot)) enhanceCourse(courseRoot, settings, planner, preview);
  ensureSearchResultScrollRoom(root);
}
