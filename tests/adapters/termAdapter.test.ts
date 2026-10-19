// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTermPreference } from '../../src/adapters/albert/termAdapter';
import { albertSelectTermEvent } from '../../src/adapters/albert/searchBridge';

const fixture = readFileSync('tests/fixtures/albert/semester-tabs.html', 'utf8').replace(/ onclick="[^"]*"/g, '');

describe('default semester tab', () => {
  let bridge: AbortController;
  beforeEach(() => {
    document.body.innerHTML = fixture;
    bridge = new AbortController();
    // Stand in for the MAIN handler's acknowledgement of the fixed request.
    document.addEventListener(albertSelectTermEvent, (event) => { event.preventDefault(); }, { signal: bridge.signal });
  });
  afterEach(() => { bridge.abort(); });

  it('requests the exact configured term without clicking its javascript URL', () => {
    const spring = document.getElementById('IS_SSS_ShCtTm1274UGRDLnk')!;
    const clicked = vi.fn();
    const requested = vi.fn();
    spring.addEventListener('click', clicked);
    spring.addEventListener(albertSelectTermEvent, requested);
    expect(applyTermPreference(document, '  spring  2027 ')).toBe(true);
    expect(requested).toHaveBeenCalledOnce();
    expect(clicked).not.toHaveBeenCalled();
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
  });

  it('retries if the MAIN bridge was not ready to handle the request', () => {
    bridge.abort();
    document.body.innerHTML = fixture;
    const spring = document.getElementById('IS_SSS_ShCtTm1274UGRDLnk')!;
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    spring.addEventListener(albertSelectTermEvent, (event) => { event.preventDefault(); });
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
  });

  it('preserves manual changes even when Albert replaces the tab links', () => {
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
    const group = document.querySelector('div')!;
    group.replaceChildren(...[...group.childNodes].map((node) => node.cloneNode(true)));
    const clicked = vi.fn();
    group.addEventListener(albertSelectTermEvent, clicked);
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

  it('does not request hidden, disabled, or ambiguous semester controls', () => {
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
