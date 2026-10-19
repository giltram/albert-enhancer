// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { applyCampusPreference } from '../../src/adapters/albert/campusAdapter';
import { parseCourse } from '../../src/adapters/albert/courseParser';
import { ALBERT_SELECTORS } from '../../src/adapters/albert/selectors';

describe('Albert adapter fixture replay', () => {
  it('keeps course identities and prerequisites within each search-result row', () => {
    document.body.innerHTML = readFileSync('tests/fixtures/albert/logged-in-machine-learning.html', 'utf8');
    const parsed = [...document.querySelectorAll(ALBERT_SELECTORS.courseRoot)].map(parseCourse);
    expect(parsed.map((result) => result?.course.code)).toEqual(['BUSF-SHU 276', 'CSCI-SHU 360', 'CSCI-SHU 360']);
    expect(parsed[0]?.information.prerequisite).toBe('Business foundations.');
    expect(parsed[2]).toMatchObject({
      course: { id: 'CSCI-SHU 360', code: 'CSCI-SHU 360', title: 'Machine Learning' },
      section: { id: 'CSCI-SHU 360:003', courseId: 'CSCI-SHU 360', classNumber: '18021', instructors: [{ name: 'Wang, Shengjie' }] },
      information: { prerequisite: 'Linear Algebra.', degreeLabels: ['CS Elective'] },
    });
  });

  it('parses only explicitly sourced course data', () => {
    document.body.innerHTML = readFileSync('tests/fixtures/albert/course-card.html', 'utf8');
    const parsed = parseCourse(document.querySelector('[data-ae-course]')!);
    expect(parsed).toMatchObject({
      course: { code: 'CSCI-SHU 210', title: 'Data Structures' },
      section: { sectionCode: '001', classNumber: '12345' },
      information: {
        prerequisite: 'Introduction to Computer Science',
        extraFee: 'Additional course fee',
        specialRule: 'Instructor permission required',
      },
    });
    expect(parsed?.section.meetings).toHaveLength(2);
  });

  it('replays the current NYU public class-search section structure', () => {
    document.body.innerHTML = readFileSync('tests/fixtures/albert/public-class-search-section.html', 'utf8');
    const parsed = parseCourse(document.querySelector('.panel__content')!);
    expect(parsed).toMatchObject({
      course: { code: 'CSCI-SHU 220', title: 'Algorithms' },
      section: { sectionCode: '001', classNumber: '7715' },
      information: { location: 'SH 567 W Yangsi Rd, Rm E204' },
    });
    expect(parsed?.section.meetings).toEqual([
      { day: 'monday', startMinute: 945, endMinute: 1020, location: 'SH 567 W Yangsi Rd, Rm E204' },
      { day: 'wednesday', startMinute: 945, endMinute: 1020, location: 'SH 567 W Yangsi Rd, Rm E204' },
    ]);
  });

  it('removes Albert expansion-control text from prerequisites', () => {
    document.body.innerHTML = `<article data-ae-course>
      <div data-ae-field="course-code">EAP-SHU 100</div><div data-ae-field="course-title">English for Academic Purposes</div>
      <div data-ae-field="section-code">001</div><div data-ae-field="prerequisite"><strong>None</strong>. <a>less description for EAP-SHU 100 «</a></div>
    </article>`;
    const parsed = parseCourse(document.querySelector('[data-ae-course]')!);
    expect(parsed?.information.prerequisite).toBe('None.');
  });

  it('replays a sanitized logged-in Albert Course Search result', () => {
    document.body.innerHTML = readFileSync('tests/fixtures/albert/logged-in-digital-logic.html', 'utf8');
    const parsed = parseCourse(document.querySelector('[id^="win0divNYU_CLS_DTL_CLASS_NBR$"]')!);
    expect(parsed).toMatchObject({
      course: { code: 'CENG-SHU 201', title: 'Digital Logic' },
      section: {
        sectionCode: '001', classNumber: '7694',
        componentType: 'lecture',
        instructors: [{ name: 'Zhou, Wen' }],
      },
      information: {
        location: 'Shanghai · 567 West Yangsi Rd, Shanghai Room N401 · 567 West Yangsi Rd, Shanghai Room S310',
        prerequisite: 'Intro to Programming or Intro to Computer Science or placement test or interaction lab.',
        extraFee: 'approximately $10 for each student',
        degreeLabels: ['CS Elective', 'CE Required', 'EE Required'],
      },
    });
    expect(parsed?.section.meetings).toEqual([
      { day: 'friday', startMinute: 1035, endMinute: 1110, location: '567 West Yangsi Rd, Shanghai Room N401' },
      { day: 'tuesday', startMinute: 765, endMinute: 840, location: '567 West Yangsi Rd, Shanghai Room S310' },
    ]);
  });

  it('keeps topic descriptions out of instructor and rule highlights', () => {
    document.body.innerHTML = readFileSync('tests/fixtures/albert/logged-in-perspectives.html', 'utf8');
    const parsed = parseCourse(document.querySelector('[id^="win0divNYU_CLS_DTL_CLASS_NBR$"]')!);
    expect(parsed).toMatchObject({
      course: { code: 'WRIT-SHU 201', title: 'Perspectives on the Humanities' },
      section: { sectionCode: '001', classNumber: '8612', componentType: 'seminar', instructors: [{ name: 'Brantner, Mark' }] },
      information: {
        instructor: 'Brantner, Mark',
        location: 'Shanghai · 567 West Yangsi Rd, Shanghai Room EB224',
      },
    });
    expect(parsed?.information.specialRule).toBeUndefined();
    expect(parsed?.information.extraFee).toBeUndefined();
  });

  it('changes campus only when the exact saved value exists', () => {
    document.body.innerHTML = '<select data-ae-campus><option value="WSQ">Washington Square</option><option value="SH">Shanghai</option></select>';
    const select = document.querySelector('select')!;
    const listener = vi.fn();
    select.addEventListener('change', listener);
    expect(applyCampusPreference(document, { enabled: true, preferredValue: 'SH' })).toBe(true);
    expect(select.value).toBe('SH');
    expect(listener).toHaveBeenCalledOnce();
    expect(applyCampusPreference(document, { enabled: true, preferredValue: 'AD' })).toBe(false);
    expect(select.value).toBe('SH');
  });

  it('selects the real logged-in Albert School filter', () => {
    document.body.innerHTML = '<select id="NYU_CLS_WRK2_DESCR254$33$"><option value=""> </option><option value="NYU Shanghai">NYU Shanghai</option></select>';
    expect(applyCampusPreference(document, { enabled: true, preferredValue: 'NYU Shanghai' })).toBe(true);
    expect((document.querySelector('select') as HTMLSelectElement).value).toBe('NYU Shanghai');
  });
});
