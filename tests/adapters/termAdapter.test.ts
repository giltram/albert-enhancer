// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTermPreference } from '../../src/adapters/albert/termAdapter';

const fixture = readFileSync('tests/fixtures/albert/semester-tabs.html', 'utf8').replaceAll(' onclick="selectSemester(this)"', '');

describe('default semester tab', () => {
  beforeEach(() => { document.body.innerHTML = fixture; });

  it('clicks the exact configured term, normalizing case and whitespace', () => {
    const spring = document.getElementById('IS_SSS_ShCtTm1274UGRDLnk')!;
    const clicked = vi.fn();
    spring.addEventListener('click', clicked);
    expect(applyTermPreference(document, '  spring  2027 ')).toBe(true);
    expect(clicked).toHaveBeenCalledOnce();
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
  });

  it('preserves manual changes even when Albert replaces the tab links', () => {
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
    const group = document.querySelector('div')!;
    group.replaceChildren(...[...group.childNodes].map((node) => node.cloneNode(true)));
    const clicked = vi.fn();
    group.addEventListener('click', clicked);
    document.body.append(document.createElement('aside'));
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    expect(clicked).not.toHaveBeenCalled();
  });

  it('treats an already-selected default as applied', () => {
    expect(applyTermPreference(document, 'Fall 2026')).toBe(false);
    document.querySelector('.selected')!.classList.remove('selected');
    expect(applyTermPreference(document, 'Fall 2026')).toBe(false);
  });

  it('applies again on reopening the page or changing the preference', () => {
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
    expect(applyTermPreference(document, 'January 2027')).toBe(true);
    document.body.innerHTML = fixture;
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
  });

  it('waits for tabs to appear asynchronously', () => {
    document.body.innerHTML = '';
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    document.body.innerHTML = fixture;
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
  });

  it('does nothing for old settings, blanks, unavailable terms, or unrelated links', () => {
    for (const value of [undefined, '', '  ', 'Spring', 'Spring 2028']) {
      expect(applyTermPreference(document, value)).toBe(false);
    }
    document.body.innerHTML = '<a href="/enroll">Spring 2027</a>';
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
  });

  it('does not click hidden, disabled, or ambiguous semester controls', () => {
    const spring = document.getElementById('IS_SSS_ShCtTm1274UGRDLnk')!;
    spring.setAttribute('aria-disabled', 'true');
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    spring.removeAttribute('aria-disabled');
    spring.parentElement!.hidden = true;
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    spring.parentElement!.hidden = false;
    spring.after(spring.cloneNode(true));
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
  });
});
