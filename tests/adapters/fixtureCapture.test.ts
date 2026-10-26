// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { parseCourse } from '../../src/adapters/albert/courseParser';
import { ALBERT_SELECTORS } from '../../src/adapters/albert/selectors';
import { readSectionGroup } from '../../src/adapters/albert/sectionGroups';
import { describe, expect, it } from 'vitest';
import { captureSanitizedFixture } from '../../src/adapters/albert/fixtureCapture';

describe('sanitized fixture capture', () => {
  it.each(['logged-in-machine-learning.html', 'public-class-search-section.html', 'linked-programming.html'])('round-trips real parser inputs and component groups: %s', (file) => {
    document.body.innerHTML = readFileSync(`tests/fixtures/albert/${file}`, 'utf8');
    const before = [...document.querySelectorAll(ALBERT_SELECTORS.courseRoot)].map(parseCourse);
    const groups = [...document.querySelectorAll(ALBERT_SELECTORS.courseRoot)].map(readSectionGroup);
    const captured = captureSanitizedFixture(document);
    document.body.innerHTML = captured;
    expect([...document.querySelectorAll(ALBERT_SELECTORS.courseRoot)].map(parseCourse)).toEqual(before);
    expect([...document.querySelectorAll(ALBERT_SELECTORS.courseRoot)].map(readSectionGroup)).toEqual(groups);
    expect(captured).not.toMatch(/<script|onclick=|javascript:/);
  });

  it('keeps parser DOM while excluding and redacting student data', () => {
    document.body.innerHTML = `<div>Name: Private Person, NetID: abc123, GPA: 4.0</div>
      <article data-ae-course class="tracking"><span data-ae-field="course-code">CSCI-SHU 220</span><span data-ae-field="course-title">Algorithms</span><span data-ae-field="section-code">001</span><span data-ae-field="special-rule">contact n12345678 or student@nyu.edu</span></article>`;
    const fixture = captureSanitizedFixture(document);
    expect(fixture).toContain('CSCI-SHU 220');
    expect(fixture).not.toContain('Private Person');
    expect(fixture).not.toContain('student@nyu.edu');
    expect(fixture).not.toContain('n12345678');
    expect(fixture).not.toContain('class="tracking"');
  });
});
