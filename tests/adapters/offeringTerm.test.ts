// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readOfferingTerm } from '../../src/adapters/albert/offeringTerm';

describe('offering semester identity', () => {
  it('prefers explicit nearest scope over another semester in the page', () => {
    document.body.innerHTML = '<h1>Fall 2026 Course Search</h1><main data-ae-term="Spring 2027"><article></article></main>';
    expect(readOfferingTerm(document.querySelector('article')!)).toBe('spring 2027');
  });
  it('reads an explicit selected semester filter', () => {
    document.body.innerHTML = '<select id="NYU_CLS_WRK_STRM"><option>Fall 2026</option><option selected>Spring 2027</option></select><article></article>';
    expect(readOfferingTerm(document.querySelector('article')!)).toBe('spring 2027');
  });
  it.each([
    '<h1>Course Search</h1>',
    '<h1>Spring 2027</h1><h1>Fall 2027</h1>',
    '<h1>Spring 2027 / Fall 2027</h1>',
    '<main data-ae-term="Spring 2027 / Fall 2027"><article></article></main>',
  ])('does not infer an absent or ambiguous semester: %s', (html) => {
    document.body.innerHTML = html.includes('article') ? html : `${html}<article></article>`;
    expect(readOfferingTerm(document.querySelector('article')!)).toBeUndefined();
  });
});
