// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disposeAlbertPage, enhanceAlbertPage } from '../../src/adapters/albert/enhancePage';
import { defaultSettings } from '../../src/features/settings/types';
import { emptyPlannerData } from '../../src/storage/plannerData';
import type { PlannerData } from '../../src/storage/plannerData';
import { rankedScheduleSearch } from '../../src/core/schedule/search';
import { parseCourse } from '../../src/adapters/albert/courseParser';

const rootHtml = (code = 'CSCI-SHU 11', section = '001') => `<article data-ae-course data-ae-term="Spring 2027">
  <span data-ae-field="course-code">${code}</span><span data-ae-field="course-title">Programming</span>
  <span data-ae-field="section-code">${section}</span><span data-ae-field="component">Lecture</span>
  <span data-ae-field="meeting">Tue 9:45-11:35</span></article>`;
function planner(): PlannerData {
  return { ...emptyPlannerData, term: 'spring 2027', courses: [{ id: 'CSCI-SHU 11', code: 'CSCI-SHU 11', title: 'Programming' }],
    intents: [{ courseId: 'CSCI-SHU 11', required: true }],
    options: [{ id: 'CSCI-SHU 11:001', courseId: 'CSCI-SHU 11', sectionIds: ['CSCI-SHU 11:001'], instructors: [], meetings: [{ day: 'tuesday', startMinute: 585, endMinute: 695 }] }],
  };
}
afterEach(() => { disposeAlbertPage(document); vi.unstubAllGlobals(); });
describe('Albert import identity and conflict display', () => {
  it('excludes the same course and its replacement sections but retains real conflicts', () => {
    document.body.innerHTML = rootHtml() + rootHtml('CSCI-SHU 11', '003') + rootHtml('OTHER 1');
    const data = planner();
    const search = rankedScheduleSearch({ options: data.options, intents: data.intents, registration: data.registration.present }, data.preferences);
    let result = search.next();
    while (!result.done) result = search.next();
    enhanceAlbertPage(document, defaultSettings, data, result.value);
    const cards = [...document.querySelectorAll('article')];
    expect(cards[0]?.querySelector('[data-kind="conflict"]')).toBeNull();
    expect(cards[1]?.querySelector('[data-kind="conflict"]')).toBeNull();
    expect(cards[2]?.querySelector('[data-kind="conflict"]')).not.toBeNull();
  });
  it('does not identify a new semester offering as already added', () => {
    document.body.innerHTML = rootHtml().replace('Spring 2027', 'Fall 2027').replace('9:45', '13:45').replace('11:35', '15:35');
    const course = parseCourse(document.querySelector('article')!)!;
    expect(course.term).toBe('fall 2027');
    const data = planner();
    const search = rankedScheduleSearch({ options: data.options, intents: data.intents, registration: data.registration.present }, data.preferences);
    let result = search.next();
    while (!result.done) result = search.next();
    enhanceAlbertPage(document, defaultSettings, data, result.value);
    expect(document.querySelector('button')?.textContent).toBe('Add to Schedule Lab');
    expect(document.querySelector('button')?.disabled).toBe(false);
    expect(document.querySelector('[data-kind="conflict"]')).toBeNull();
  });
  it('does not read planner data to solve conflicts when highlighting is disabled', () => {
    document.body.innerHTML = rootHtml();
    const data = planner();
    Object.defineProperty(data, 'registration', { get() { throw new Error('should not solve'); } });
    enhanceAlbertPage(document, { ...defaultSettings, highlights: { ...defaultSettings.highlights, conflicts: false } }, data);
    expect(document.querySelector('[data-kind="conflict"]')).toBeNull();
  });
});
