// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import script from '../../src/entrypoints/albert-search-main.content';
import { albertSelectTermEvent } from '../../src/adapters/albert/searchBridge';
import { applyTermPreference } from '../../src/adapters/albert/termAdapter';

describe('MAIN semester bridge', () => {
  const ShopCartTermSelect = vi.fn();
  const makeTablesResponsivePostLoad = vi.fn();
  const DisplayToggleButton = vi.fn();
  const sss = { ShopCartTermSelect };
  const handlers: Array<[string, EventListenerOrEventListenerObject, (boolean | AddEventListenerOptions | undefined)?]> = [];
  beforeEach(async () => {
    vi.resetAllMocks();
    document.body.innerHTML = '<a id="IS_SSS_ShCtTm1274UGRDLnk" data-termclass="isSSS_ShCtTm1274UGRD" href="javascript:void(0);">Spring 2027</a>';
    vi.stubGlobal('IS', { SSS: sss });
    vi.stubGlobal('makeTablesResponsivePostLoad', makeTablesResponsivePostLoad);
    vi.stubGlobal('DisplayToggleButton', DisplayToggleButton);
    const registered = vi.spyOn(document, 'addEventListener');
    // MAIN scripts run without a WXT context; this argument only satisfies the union type.
    await script.main(undefined as unknown as ContentScriptContext);
    handlers.push(...registered.mock.calls);
    registered.mockRestore();
  });
  afterEach(() => {
    for (const [type, handler, options] of handlers.splice(0)) document.removeEventListener(type, handler, options);
    vi.unstubAllGlobals();
  });

  function request(tab: Element): Event {
    const event = new Event(albertSelectTermEvent, { bubbles: true, cancelable: true });
    tab.dispatchEvent(event);
    return event;
  }

  it('calls the fixed page function and acknowledges without clicking the link', () => {
    const tab = document.querySelector('a')!;
    const clicked = vi.fn();
    tab.addEventListener('click', clicked);
    expect(request(tab).defaultPrevented).toBe(true);
    expect(ShopCartTermSelect).toHaveBeenCalledExactlyOnceWith(tab);
    expect(ShopCartTermSelect.mock.contexts[0]).toBe(sss);
    expect(makeTablesResponsivePostLoad).toHaveBeenCalledExactlyOnceWith(tab.parentElement);
    expect(DisplayToggleButton).toHaveBeenCalledExactlyOnceWith('1274UGRD');
    expect(ShopCartTermSelect.mock.invocationCallOrder[0]).toBeLessThan(makeTablesResponsivePostLoad.mock.invocationCallOrder[0]!);
    expect(makeTablesResponsivePostLoad.mock.invocationCallOrder[0]).toBeLessThan(DisplayToggleButton.mock.invocationCallOrder[0]!);
    expect(clicked).not.toHaveBeenCalled();
  });

  it('rejects unrelated, disabled, and hidden targets', () => {
    const unrelated = document.createElement('a');
    document.body.append(unrelated);
    expect(request(unrelated).defaultPrevented).toBe(false);
    const tab = document.querySelector('a')!;
    tab.setAttribute('aria-disabled', 'true');
    expect(request(tab).defaultPrevented).toBe(false);
    tab.removeAttribute('aria-disabled');
    tab.hidden = true;
    expect(request(tab).defaultPrevented).toBe(false);
    expect(ShopCartTermSelect).not.toHaveBeenCalled();
  });

  it('leaves the request unacknowledged if Albert has not loaded its function', () => {
    vi.stubGlobal('IS', undefined);
    expect(request(document.querySelector('a')!).defaultPrevented).toBe(false);
  });

  it('rejects inconsistent term metadata without invoking page functions', () => {
    const tab = document.querySelector('a')!;
    tab.setAttribute('data-termclass', 'isSSS_ShCtTm1268UGRD');
    expect(request(tab).defaultPrevented).toBe(false);
    expect(ShopCartTermSelect).not.toHaveBeenCalled();
  });

  it('retries when the real page API becomes ready and then preserves manual choices', () => {
    vi.stubGlobal('DisplayToggleButton', undefined);
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    expect(ShopCartTermSelect).not.toHaveBeenCalled();
    vi.stubGlobal('DisplayToggleButton', DisplayToggleButton);
    expect(applyTermPreference(document, 'Spring 2027')).toBe(true);
    expect(ShopCartTermSelect).toHaveBeenCalledOnce();
    expect(applyTermPreference(document, 'Spring 2027')).toBe(false);
    expect(ShopCartTermSelect).toHaveBeenCalledOnce();
  });
});
