// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { defaultSettings } from '../../src/features/settings/types';
import { emptyPlannerData } from '../../src/storage/plannerData';
import script from '../../src/entrypoints/content';
import { albertSessionConfirmEvent, albertTitleSearchEvent } from '../../src/adapters/albert/searchBridge';

const mocks = vi.hoisted(() => ({
  settings: { getValue: vi.fn(), watch: vi.fn() }, planner: { getValue: vi.fn(), watch: vi.fn() },
  campuses: { getValue: vi.fn(), setValue: vi.fn() },
  runtime: { id: 'test', sendMessage: vi.fn(), getManifest: () => ({ version: 'test' }) },
}));
vi.mock('wxt/browser', () => ({ browser: { runtime: mocks.runtime } }));
vi.mock('../../src/storage/settings', () => ({ settingsItem: mocks.settings }));
vi.mock('../../src/storage/planner', async () => ({ ...(await import('../../src/storage/plannerData')), plannerItem: mocks.planner }));
vi.mock('../../src/storage/campuses', () => ({ campusOptionsItem: mocks.campuses }));

const contexts: ContentScriptContext[] = [];
async function start(): Promise<ContentScriptContext> {
  const context = new ContentScriptContext('content');
  contexts.push(context);
  await script.main(context);
  return context;
}
function enter(input: HTMLInputElement): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  return event;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('browser', { runtime: mocks.runtime });
  mocks.settings.getValue.mockResolvedValue(defaultSettings);
  mocks.settings.watch.mockReturnValue(() => {});
  mocks.planner.getValue.mockResolvedValue(emptyPlannerData);
  mocks.planner.watch.mockReturnValue(() => {});
  mocks.campuses.getValue.mockResolvedValue([]);
  document.body.innerHTML = '<input id="NYU_CLS_DERIVED_DESCR100"><button id="BUTTON_SMALL">Search</button>';
});
afterEach(() => { contexts.splice(0).forEach((context) => context.notifyInvalidated()); vi.unstubAllGlobals(); });

describe('content lifecycle with real Albert adapter', () => {
  it('removes native search listeners on disable and uses new settings after reinjection', async () => {
    const custom = (expansion: string) => ({ ...defaultSettings, customAbbreviations: [{ abbreviation: 'XX', expansion, enabled: true }] });
    mocks.settings.getValue.mockResolvedValue(custom('Old phrase'));
    const context = await start();
    const input = document.querySelector('input')!;
    input.value = 'XX';
    expect(enter(input).defaultPrevented).toBe(true);
    expect(input.value).toBe('Old phrase');
    const search = vi.fn();
    document.addEventListener(albertTitleSearchEvent, search);
    const changeSettings = mocks.settings.watch.mock.calls[0]![0] as (value: unknown) => void;
    changeSettings({ ...custom('Old phrase'), enabled: false });
    input.value = 'XX';
    expect(enter(input).defaultPrevented).toBe(false);
    document.querySelector('button')!.click();
    expect(input.value).toBe('XX');
    expect(search).not.toHaveBeenCalled();
    expect(input.dataset.aeAbbreviationSearch).toBeUndefined();
    changeSettings(custom('Old phrase'));
    context.notifyInvalidated();
    expect(input.dataset.aeAbbreviationSearch).toBeUndefined();
    mocks.settings.getValue.mockResolvedValue(custom('New phrase'));
    await start();
    expect(enter(input).defaultPrevented).toBe(true);
    expect(input.value).toBe('New phrase');
    expect(search).toHaveBeenCalledOnce();
    document.removeEventListener(albertTitleSearchEvent, search);
  });
  it('never dispatches a session renewal when disabled', async () => {
    mocks.settings.getValue.mockResolvedValue({ ...defaultSettings, enabled: false, keepSessionAlive: true });
    document.body.insertAdjacentHTML('beforeend', '<p>Your session is about to expire</p><a href="https://sis.nyu.edu/?cmd=resettimeout">OK</a>');
    const renew = vi.fn();
    document.addEventListener(albertSessionConfirmEvent, renew);
    await start();
    expect(renew).not.toHaveBeenCalled();
    document.removeEventListener(albertSessionConfirmEvent, renew);
  });
});
