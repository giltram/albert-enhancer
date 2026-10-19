import type { EnrollmentOption } from '../../core/courses';
import { classifyCourse } from '../../core/curriculum';
import { optionsConflict, rankSchedules, solveSchedules } from '../../core/schedule';
import { nyushComputerScience, nyushEconomics } from '../../curricula/nyush';
import { expandAbbreviations, resolveAbbreviationQuery } from '../../features/abbreviations';
import { buildHighlights } from '../../features/highlighting';
import type { AlbertEnhancerSettings } from '../../features/settings';
import { normalizePlannerData, plannerItem } from '../../storage/planner';
import type { PlannerData } from '../../storage/planner';
import { applyCampusPreference } from './campusAdapter';
import { parseCourse } from './courseParser';
import { albertDescriptionSearchEvent, albertTitleSearchEvent } from './searchBridge';
import { ALBERT_SELECTORS } from './selectors';
import { applyTermPreference } from './termAdapter';

let latestSettings: AlbertEnhancerSettings | undefined;

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

async function addToPlanner(root: Element): Promise<void> {
  const parsed = parseCourse(root);
  if (parsed === undefined) return;
  const current = normalizePlannerData(await plannerItem.getValue());
  const option: EnrollmentOption = {
    id: parsed.section.id,
    courseId: parsed.course.id,
    sectionIds: [parsed.section.id],
    components: [{
      sectionId: parsed.section.id,
      componentType: parsed.section.componentType,
      ...(parsed.section.sectionCode === undefined ? {} : { sectionCode: parsed.section.sectionCode }),
      ...(parsed.section.classNumber === undefined ? {} : { classNumber: parsed.section.classNumber }),
      meetings: parsed.section.meetings,
      instructors: parsed.section.instructors ?? [],
    }],
    meetings: parsed.section.meetings,
    instructors: parsed.section.instructors ?? [],
  };
  await plannerItem.setValue({
    ...current,
    courses: [...current.courses.filter((course) => course.id !== parsed.course.id), parsed.course],
    options: [...current.options.filter((existing) => existing.id !== option.id), option],
    intents: current.intents.some((intent) => intent.courseId === parsed.course.id)
      ? current.intents
      : [...current.intents, { courseId: parsed.course.id, required: true }],
  });
}

function conflictsForCourse(parsedOption: EnrollmentOption, planner?: PlannerData) {
  if (planner === undefined) return [];
  const problem = { intents: planner.intents, options: planner.options, registration: planner.registration.present };
  const current = rankSchedules(solveSchedules(problem), planner.preferences, problem)[0];
  if (current === undefined) return [];
  return current.options.flatMap((option) => {
    if (!optionsConflict(parsedOption, option)) return [];
    const courseCode = planner.courses.find((course) => course.id === option.courseId)?.code ?? option.courseId;
    const meeting = option.meetings.find((otherMeeting) => parsedOption.meetings.some((meeting) => meeting.day === otherMeeting.day && meeting.startMinute < otherMeeting.endMinute && otherMeeting.startMinute < meeting.endMinute));
    return meeting === undefined ? [] : [{ courseCode, meeting }];
  });
}

function enhanceCourse(root: Element, settings: AlbertEnhancerSettings, planner?: PlannerData): void {
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
  for (const highlight of buildHighlights(information, settings.highlights, conflictsForCourse(option, planner))) {
    panel.append(highlightNode(highlight.kind, highlight.label, highlight.value, highlight.priority));
  }

  const actions = document.createElement('div');
  actions.className = 'ae-actions';
  const add = document.createElement('button');
  add.type = 'button';
  const alreadyAdded = planner?.options.some((existing) => existing.id === parsed.section.id) ?? false;
  add.textContent = alreadyAdded ? 'Added' : 'Add to Schedule Lab';
  add.disabled = alreadyAdded;
  if (!alreadyAdded) add.addEventListener('click', () => { void addToPlanner(root).then(() => { add.textContent = 'Added'; }); });
  actions.append(add);
  if (parsed.section.classNumber !== undefined) {
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy Class Number';
    copy.addEventListener('click', () => { void navigator.clipboard.writeText(parsed.section.classNumber!); });
    actions.append(copy);
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

function resolveSearchInput(input: HTMLInputElement): void {
  const settings = latestSettings;
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

function ensureAbbreviationSearch(root: ParentNode): void {
  const queries = [...root.querySelectorAll<HTMLInputElement>(ALBERT_SELECTORS.courseSearchQuery)];
  for (const input of queries) {
    if (input.dataset.aeAbbreviationSearch === 'true') continue;
    input.dataset.aeAbbreviationSearch = 'true';
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return;
      const searchEvent = searchEventForInput(input);
      if (searchEvent === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      resolveSearchInput(input);
      input.ownerDocument.dispatchEvent(new Event(searchEvent));
    }, true);
  }
  for (const submit of root.querySelectorAll<HTMLElement>(ALBERT_SELECTORS.courseSearchSubmit)) {
    if (submit.dataset.aeAbbreviationSearch === 'true') continue;
    submit.dataset.aeAbbreviationSearch = 'true';
    submit.addEventListener('click', () => {
      const inputId = submit.id === 'BUTTON_SMALL'
        ? 'NYU_CLS_DERIVED_DESCR100'
        : submit.id === 'SMALL_BUTTON' ? 'NYU_CLS_DERIVED_DESCR100_JOB_POST1' : undefined;
      if (inputId !== undefined) {
        const input = root.querySelector<HTMLInputElement>(`#${inputId}`);
        if (input !== null) resolveSearchInput(input);
        return;
      }
      const container = submit.closest('[data-ae-search]') ?? root;
      for (const input of container.querySelectorAll<HTMLInputElement>(ALBERT_SELECTORS.courseSearchQuery)) resolveSearchInput(input);
    }, true);
  }
}

export function enhanceAlbertPage(root: ParentNode, settings: AlbertEnhancerSettings, planner?: PlannerData): void {
  latestSettings = settings;
  if (!settings.enabled) return;
  applyTermPreference(root, settings.preferredTerm);
  applyCampusPreference(root, settings.campus);
  ensureAbbreviationSearch(root);
  ensureCourseSearchToolbar(root, settings);
  for (const courseRoot of root.querySelectorAll(ALBERT_SELECTORS.courseRoot)) enhanceCourse(courseRoot, settings, planner);
  ensureSearchResultScrollRoom(root);
}
