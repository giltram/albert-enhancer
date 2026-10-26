import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyPlannerData, normalizePlannerData } from '../../src/storage/plannerData';
import type { PlannerData } from '../../src/storage/plannerData';
import type { DegreePlanEntry } from '../../src/core/curriculum';

const state = vi.hoisted(() => ({ planner: {} as PlannerData, degree: [] as readonly DegreePlanEntry[], fail: false }));
vi.mock('../../src/storage/planner', () => ({
  normalizePlannerData,
  plannerItem: {
    getValue: async () => structuredClone(state.planner),
    setValue: async (next: PlannerData) => { if (state.fail) throw new Error('save failed'); state.planner = next; },
  },
}));
vi.mock('../../src/storage/degreePlan', () => ({ degreePlanItem: {
  getValue: async () => structuredClone(state.degree),
  setValue: async (next: readonly DegreePlanEntry[]) => { state.degree = next; },
} }));
vi.mock('@wxt-dev/storage', () => ({ storage: { clear: async () => { state.planner = emptyPlannerData; state.degree = []; } } }));
import { createStorageWriter } from '../../src/storage/writer';

function courseImport(id: string, term = 'spring 2027') {
  return { type: 'update-planner', change: {
    type: 'import', course: { id, code: id, title: id }, primarySectionId: `${id}:001`, sectionIds: [`${id}:001`],
    options: [{ id: `${id}:001`, courseId: id, sectionIds: [`${id}:001`], meetings: [], instructors: [] }], term,
  } } as const;
}
beforeEach(() => { state.planner = emptyPlannerData; state.degree = []; state.fail = false; });

describe('background storage writer', () => {
  it('preserves a concurrent import when an old page changes preferences', async () => {
    const write = createStorageWriter();
    await write(courseImport('A'));
    const oldPageSnapshot = structuredClone(state.planner);
    const results = await Promise.all([
      write(courseImport('B')),
      write({ type: 'update-planner', change: { type: 'avoid-friday', value: !oldPageSnapshot.preferences.avoidFriday } }),
    ]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(state.planner.courses.map((course) => course.id)).toEqual(['A', 'B']);
    expect(state.planner.preferences.avoidFriday).toBe(true);
  });

  it('serializes independent imports, degree changes, and data deletion', async () => {
    const write = createStorageWriter();
    await Promise.all([write(courseImport('A')), write(courseImport('B'))]);
    expect(state.planner.options).toHaveLength(2);
    await Promise.all(['A', 'B'].map((courseId) => write({ type: 'update-degree', change: { type: 'add', entry: { courseId, credits: 4, progress: 'planned' } } })));
    await Promise.all([
      write({ type: 'update-degree', change: { type: 'progress', courseId: 'A', progress: 'taken' } }),
      write({ type: 'update-degree', change: { type: 'remove', courseId: 'B' } }),
    ]);
    expect(state.degree).toEqual([{ courseId: 'A', credits: 4, progress: 'taken' }]);
    await Promise.all([write(courseImport('C')), write({ type: 'clear-local-data' })]);
    expect(state.planner.courses).toEqual([]);
    expect(state.degree).toEqual([]);
  });

  it('refuses different or unidentified semesters without deleting existing data', async () => {
    const write = createStorageWriter();
    await write(courseImport('A'));
    const before = structuredClone(state.planner);
    expect((await write(courseImport('A', 'fall 2027'))).ok).toBe(false);
    expect(state.planner).toEqual(before);
    state.planner = { ...before, term: null };
    expect((await write(courseImport('B'))).ok).toBe(false);
    expect(state.planner.courses).toEqual(before.courses);
    await write({ type: 'update-planner', change: { type: 'remove', courseId: 'A' } });
    expect((await write(courseImport('B', 'fall 2027'))).ok).toBe(true);
    expect(state.planner.term).toBe('fall 2027');
  });

  it('recovers the queue after a failed write', async () => {
    const write = createStorageWriter();
    state.fail = true;
    expect(await write(courseImport('A'))).toMatchObject({ ok: false, error: 'save failed' });
    state.fail = false;
    expect(await write(courseImport('B'))).toEqual({ ok: true });
    expect(state.planner.courses.map((course) => course.id)).toEqual(['B']);
  });
});
