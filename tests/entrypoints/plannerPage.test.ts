// @vitest-environment jsdom
import { act, fireEvent, waitFor, within } from '@testing-library/react';
import ReactDOM from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { emptyPlannerData } from '../../src/storage/plannerData';
import type { PlannerData } from '../../src/storage/plannerData';
import { applyPlannerMutation } from '../../src/storage/mutations';
import type { PlannerMutation } from '../../src/storage/mutations';

const state = vi.hoisted(() => ({ data: {} as PlannerData, listener: undefined as ((value: PlannerData) => void) | undefined }));
vi.mock('../../src/storage/planner', async () => ({ ...(await import('../../src/storage/plannerData')), plannerItem: {
  getValue: async () => state.data,
  watch: (listener: (value: PlannerData) => void) => { state.listener = listener; return () => { state.listener = undefined; }; },
} }));
vi.mock('../../src/storage/commands', () => ({ updatePlanner: async (change: PlannerMutation) => {
  state.data = applyPlannerMutation(state.data, change);
  state.listener?.(state.data);
} }));
let root: Root | undefined;
afterEach(async () => { await act(() => root?.unmount()); vi.restoreAllMocks(); });

async function renderPlanner(): Promise<void> {
  vi.resetModules();
  document.body.innerHTML = '<div id="root"></div>';
  const createRoot = ReactDOM.createRoot;
  vi.spyOn(ReactDOM, 'createRoot').mockImplementation((...args) => { root = createRoot(...args); return root; });
  await act(async () => { await import('../../src/entrypoints/planner/main'); });
}

function linkedCourse(recitationIds = ['REC001']): PlannerData {
  return {
    ...emptyPlannerData,
    courses: [{ id: 'A', code: 'A', title: 'Linked course' }],
    intents: [{ courseId: 'A', required: true }],
    options: recitationIds.map((sectionId) => ({
      id: `A:LEC001+${sectionId}`, courseId: 'A', sectionIds: ['LEC001', sectionId], instructors: [], meetings: [],
      components: [
        { sectionId: 'LEC001', componentType: 'lecture', meetings: [{ day: 'monday', startMinute: 600, endMinute: 660 }] },
        { sectionId, componentType: 'recitation', meetings: [{ day: 'tuesday', startMinute: 600, endMinute: 660 }] },
      ],
    })),
  };
}

it('renders Saturday/Sunday meetings and preserves newly imported data on a page preference change', async () => {
  state.data = {
    ...emptyPlannerData,
    courses: [{ id: 'A', code: 'A', title: 'Weekend class' }],
    intents: [{ courseId: 'A', required: true }],
    options: [{ id: 'A:001', courseId: 'A', sectionIds: ['A:001'], instructors: [], meetings: [
      { day: 'saturday', startMinute: 600, endMinute: 660 }, { day: 'sunday', startMinute: 700, endMinute: 760 },
    ] }],
  };
  await renderPlanner();
  await waitFor(() => expect(document.querySelectorAll('.meeting')).toHaveLength(2));
  expect([...document.querySelectorAll('.day > b')].map((node) => node.textContent)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  // A second document imports B after this page was opened.
  state.data = { ...state.data, courses: [...state.data.courses, { id: 'B', code: 'B', title: 'New import' }], intents: [...state.data.intents, { courseId: 'B', required: false }] };
  const friday = [...document.querySelectorAll('label')].find((node) => node.textContent?.includes('Avoid Friday'))!.querySelector('input')!;
  await act(async () => { fireEvent.click(friday); });
  await waitFor(() => expect(document.querySelectorAll('.course-title')).toHaveLength(2));
  expect(state.data.courses.map((course) => course.id)).toEqual(['A', 'B']);
  expect(state.data.preferences.avoidFriday).toBe(true);
});

it('shows a sole lecture and recitation without section choice controls', async () => {
  state.data = linkedCourse();
  await renderPlanner();
  const courses = within(document.querySelector('.courses')!);
  expect(document.querySelectorAll('.component-row')).toHaveLength(2);
  expect([...document.querySelectorAll('.component-row small')].map((node) => node.textContent)).toEqual(['Mon 10:00–11:00', 'Tue 10:00–11:00']);
  expect(document.querySelectorAll('.component-row button')).toHaveLength(0);
  expect(courses.queryByRole('button', { name: 'Reset choices' })).toBeNull();
  expect((courses.getByRole('checkbox', { name: 'Required' }) as HTMLInputElement).checked).toBe(true);
  expect(courses.getByRole('button', { name: 'Remove A' })).toBeTruthy();
});

it('keeps recitation controls when requiring one alternative leaves only one visible section', async () => {
  state.data = linkedCourse(['REC001', 'REC002']);
  await renderPlanner();
  const lecture = within(document.querySelector('.courses')!).getByRole('heading', { name: 'Lecture' }).parentElement!;
  const recitation = within(document.querySelector('.courses')!).getByRole('heading', { name: 'Recitation' }).parentElement!;
  expect(within(lecture).queryAllByRole('button')).toHaveLength(0);
  expect(within(recitation).getAllByRole('button', { name: 'Prefer' })).toHaveLength(2);
  await act(async () => { fireEvent.click(within(recitation).getAllByRole('button', { name: 'Require' })[0]!); });
  expect(recitation.querySelectorAll('.component-row')).toHaveLength(1);
  expect(within(recitation).getByRole('button', { name: 'Prefer' })).toBeTruthy();
  expect(within(recitation).getByRole('button', { name: 'Exclude' })).toBeTruthy();
  await act(async () => { fireEvent.click(within(recitation).getByRole('button', { name: 'Any' })); });
  expect(recitation.querySelectorAll('.component-row')).toHaveLength(2);
});

it.each([
  ['preferredSectionIds', 'Unprefer'],
  ['requiredSectionIds', 'Any'],
  ['excludedSectionIds', 'Include'],
] as const)('allows clearing an existing %s choice for a sole component', async (field, label) => {
  state.data = linkedCourse();
  state.data = { ...state.data, intents: [{ courseId: 'A', required: true, [field]: ['REC001'] }] };
  await renderPlanner();
  const groups = within(document.querySelector('.component-groups')!);
  expect(groups.getAllByRole('button').map((button) => button.textContent)).toEqual([label]);
  expect(within(document.querySelector('.courses')!).getByRole('button', { name: 'Reset choices' })).toBeTruthy();
  await act(async () => { fireEvent.click(groups.getByRole('button', { name: label })); });
  expect(state.data.intents[0]![field]).toEqual([]);
  expect(groups.queryAllByRole('button')).toHaveLength(0);
  expect(document.querySelectorAll('.component-row')).toHaveLength(2);
  expect(within(document.querySelector('.courses')!).queryByRole('button', { name: 'Reset choices' })).toBeNull();
});
