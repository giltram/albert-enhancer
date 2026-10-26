// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentScriptContext } from 'wxt/utils/content-script-context';
import { defaultSettings } from '../../src/features/settings/types';
import { emptyPlannerData } from '../../src/storage/plannerData';
import script from '../../src/entrypoints/content';
import { albertMainBridgeReadyEvent } from '../../src/adapters/albert/searchBridge';

const mocks = vi.hoisted(() => ({
  runtime: { id: 'test-extension' as string | undefined },
  settings: { getValue: vi.fn(), watch: vi.fn() },
  planner: { getValue: vi.fn(), watch: vi.fn() },
  campuses: { getValue: vi.fn(), setValue: vi.fn() },
  enhance: vi.fn(),
  dispose: vi.fn(),
  confirm: vi.fn(),
  unwatchSettings: vi.fn(),
  unwatchPlanner: vi.fn(),
}));

vi.mock('wxt/browser', () => ({ browser: { runtime: mocks.runtime } }));
vi.mock('../../src/storage/settings', () => ({ settingsItem: mocks.settings }));
vi.mock('../../src/storage/planner', () => ({ plannerItem: mocks.planner, normalizePlannerData: (value: unknown) => value }));
vi.mock('../../src/storage/campuses', () => ({ campusOptionsItem: mocks.campuses }));
vi.mock('../../src/adapters/albert', () => ({
  captureSanitizedFixture: vi.fn(),
  collectCampusOptions: () => [],
  confirmSessionExpiry: mocks.confirm,
  disposeAlbertPage: mocks.dispose,
  enhanceAlbertPage: mocks.enhance,
}));

describe('content script lifecycle', () => {
  let ctx: ContentScriptContext;
  beforeEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
    mocks.runtime.id = 'test-extension';
    mocks.settings.getValue.mockResolvedValue(defaultSettings);
    mocks.planner.getValue.mockResolvedValue(emptyPlannerData);
    mocks.campuses.getValue.mockResolvedValue([]);
    mocks.settings.watch.mockReturnValue(mocks.unwatchSettings);
    mocks.planner.watch.mockReturnValue(mocks.unwatchPlanner);
    ctx = new ContentScriptContext('content');
  });
  afterEach(() => { ctx.notifyInvalidated(); });

  it('stops observing, unsubscribes storage, and removes old UI after extension reload', async () => {
    await script.main(ctx);
    const enhancementsBeforeReload = mocks.enhance.mock.calls.length;
    expect(enhancementsBeforeReload).toBeGreaterThan(0);
    // Chrome leaves the old DOM and content script in the tab after extension reload.
    mocks.runtime.id = undefined;
    document.body.innerHTML = '<aside data-ae-enhancement>Old toolbar</aside>';
    await vi.waitFor(() => { expect(mocks.unwatchSettings).toHaveBeenCalledOnce(); });
    expect(mocks.unwatchPlanner).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-ae-enhancement]')).toBeNull();
    expect(mocks.dispose).toHaveBeenCalledWith(document);
    expect(document.documentElement.dataset.albertEnhancer).toBeUndefined();

    document.body.append(document.createElement('p'));
    document.dispatchEvent(new Event(albertMainBridgeReadyEvent));
    const settingsChanged = mocks.settings.watch.mock.calls[0]![0] as (value: unknown) => void;
    settingsChanged({ keepSessionAlive: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.enhance).toHaveBeenCalledTimes(enhancementsBeforeReload);
  });

  it('does not renew sessions when the master switch is disabled', async () => {
    mocks.settings.getValue.mockResolvedValue({ enabled: false, keepSessionAlive: true });
    await script.main(ctx);
    expect(mocks.confirm).toHaveBeenCalledWith(document, false);
  });

  it('does not continue initialization if invalidated during a storage read', async () => {
    let resolveSettings!: (value: unknown) => void;
    mocks.settings.getValue.mockReturnValue(new Promise((resolve) => { resolveSettings = resolve; }));
    const startup = script.main(ctx);
    ctx.notifyInvalidated();
    resolveSettings({ keepSessionAlive: false });
    await startup;
    expect(mocks.planner.getValue).not.toHaveBeenCalled();
    expect(mocks.enhance).not.toHaveBeenCalled();
    expect(mocks.settings.watch).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.albertEnhancer).toBeUndefined();
  });
});
