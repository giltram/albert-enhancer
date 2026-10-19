import { ALBERT_SELECTORS } from './selectors';

export interface HomeToolbarActions {
  readonly openScheduleLab: () => void;
  readonly openDegreePlanner: () => void;
  readonly openSettings: () => void;
}

/** Share Albert's semester container so shortcuts inherit its native width and margins. */
export function ensureHomeToolbar(root: ParentNode, actions: HomeToolbarActions): void {
  if (root.querySelector('[data-ae-home-toolbar]') !== null) return;
  const group = [...root.querySelectorAll(ALBERT_SELECTORS.homeSemesterGroup)].find((element) =>
    element.querySelector(ALBERT_SELECTORS.semesterTab) !== null
    && element.closest('[hidden], [inert], [aria-hidden="true"]') === null);
  if (group === undefined) return;
  const doc = group.ownerDocument;
  const toolbar = doc.createElement('nav');
  toolbar.className = 'ae-home-toolbar';
  toolbar.dataset.aeHomeToolbar = '';
  toolbar.dataset.aeEnhancement = '';
  toolbar.setAttribute('aria-label', 'Planning tools');
  const lab = doc.createElement('button');
  lab.type = 'button';
  lab.className = 'ae-navigation-button';
  lab.textContent = 'Schedule Lab';
  lab.addEventListener('click', actions.openScheduleLab);
  const degree = doc.createElement('button');
  degree.type = 'button';
  degree.className = 'ae-navigation-button';
  degree.textContent = 'Degree Planner';
  degree.addEventListener('click', actions.openDegreePlanner);
  const settings = doc.createElement('button');
  settings.type = 'button';
  settings.className = 'ae-navigation-button';
  settings.textContent = 'Settings';
  settings.addEventListener('click', actions.openSettings);
  toolbar.append(lab, degree, settings);
  group.prepend(toolbar);
}
