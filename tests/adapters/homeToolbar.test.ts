// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureHomeToolbar } from '../../src/adapters/albert/homeToolbar';

const fixture = readFileSync('tests/fixtures/albert/semester-tabs.html', 'utf8');

describe('Albert home shortcuts', () => {
  const actions = { openScheduleLab: vi.fn(), openDegreePlanner: vi.fn(), openSettings: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = `<form>${fixture}</form>`;
  });

  it('keeps three working shortcuts inside the semester container without the Albert Enhancer label', () => {
    const submitted = vi.fn((event: Event) => event.preventDefault());
    document.querySelector('form')!.addEventListener('submit', submitted);
    ensureHomeToolbar(document, actions);
    const toolbar = document.querySelector('[data-ae-home-toolbar]')!;
    expect(toolbar.parentElement).toBe(document.querySelector('.isSSS_ShopCart'));
    expect(toolbar.parentElement!.firstElementChild).toBe(toolbar);
    expect(toolbar.nextElementSibling).toBe(document.getElementById('IS_SSS_ShCtTm1268UGRDLnk'));
    expect(toolbar.textContent).not.toContain('Albert Enhancer');
    const [lab, degree, settings] = toolbar.querySelectorAll('button');
    expect(lab!.textContent).toBe('Schedule Lab');
    expect(degree!.textContent).toBe('Degree Planner');
    expect(degree!.className).toBe(lab!.className);
    expect(settings!.textContent).toBe('Settings');
    expect(settings!.className).toBe(lab!.className);
    lab!.click();
    degree!.click();
    settings!.click();
    expect(actions.openScheduleLab).toHaveBeenCalledOnce();
    expect(actions.openDegreePlanner).toHaveBeenCalledOnce();
    expect(actions.openSettings).toHaveBeenCalledOnce();
    expect(submitted).not.toHaveBeenCalled();
  });

  it('restores one working set of shortcuts after semester content is redrawn', () => {
    ensureHomeToolbar(document, actions);
    const group = document.querySelector('.isSSS_ShopCart')!;
    const source = document.createElement('div');
    source.innerHTML = fixture;
    group.innerHTML = source.querySelector('.isSSS_ShopCart')!.innerHTML;
    ensureHomeToolbar(document, actions);
    ensureHomeToolbar(document, actions);
    expect(document.querySelectorAll('[data-ae-home-toolbar]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-ae-home-toolbar] button')).toHaveLength(3);
    document.querySelector<HTMLButtonElement>('[data-ae-home-toolbar] button')!.click();
    expect(actions.openScheduleLab).toHaveBeenCalledOnce();
  });
});
