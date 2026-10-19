// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { captureSanitizedFixture } from '../../src/adapters/albert/fixtureCapture';

describe('sanitized fixture capture', () => {
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
