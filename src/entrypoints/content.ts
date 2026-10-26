import { defineContentScript } from 'wxt/utils/define-content-script';
import { captureSanitizedFixture, collectCampusOptions, confirmSessionExpiry, disposeAlbertPage, enhanceAlbertPage } from '../adapters/albert';
import { settingsItem } from '../storage/settings';
import { normalizePlannerData, plannerItem } from '../storage/planner';
import { campusOptionsItem } from '../storage/campuses';
import type { ScheduleSearchResult } from '../core/schedule';
import { searchSchedulePreview } from '../features/planner/scheduleSearch';
import { albertMainBridgeReadyEvent } from '../adapters/albert/searchBridge';
import '../adapters/albert/enhancements.css';

export default defineContentScript({
  matches: ['https://*.nyu.edu/*'],
  allFrames: true,
  async main(ctx) {
    if (ctx.isInvalid) return;
    document.documentElement.dataset.albertEnhancer = 'active';
    ctx.onInvalidated(() => {
      disposeAlbertPage(document);
      for (const panel of document.querySelectorAll('[data-ae-enhancement], .ae-fixture-capture')) panel.remove();
      delete document.documentElement.dataset.albertEnhancer;
    });
    let settings = await settingsItem.getValue();
    if (ctx.isInvalid) return;
    let planner = normalizePlannerData(await plannerItem.getValue());
    if (ctx.isInvalid) return;
    let lastCampusOptions = JSON.stringify(await campusOptionsItem.getValue());
    if (ctx.isInvalid) return;
    let preview: ScheduleSearchResult | undefined;
    let previewPlanner: typeof planner | undefined;
    let previewController: AbortController | undefined;
    ctx.onInvalidated(() => previewController?.abort());
    const updatePreview = (): void => {
      if (!settings.enabled || !settings.highlights.conflicts || planner.options.length === 0) {
        previewController?.abort(); previewPlanner = undefined; preview = undefined;
        return;
      }
      if (previewPlanner === planner) return;
      previewController?.abort();
      const controller = new AbortController();
      previewController = controller;
      previewPlanner = planner;
      preview = undefined;
      const problem = { intents: planner.intents, options: planner.options, registration: planner.registration.present };
      void searchSchedulePreview(problem, planner.preferences, controller.signal).then((result) => {
        if (ctx.isInvalid || controller.signal.aborted || result === undefined) return;
        preview = result;
        refresh();
      });
    };
    const enhance = (): void => {
      if (ctx.isInvalid) return;
      updatePreview();
      confirmSessionExpiry(document, settings.enabled && settings.keepSessionAlive);
      enhanceAlbertPage(document, settings, planner, preview);
      const campusOptions = collectCampusOptions(document);
      const serialized = JSON.stringify(campusOptions);
      if (campusOptions.length > 0 && serialized !== lastCampusOptions) {
        lastCampusOptions = serialized;
        void campusOptionsItem.setValue(campusOptions);
      }
    };
    const refresh = (): void => {
      if (ctx.isInvalid) return;
      for (const panel of document.querySelectorAll('[data-ae-enhancement]')) panel.remove();
      enhance();
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.addEventListener(document, albertMainBridgeReadyEvent, enhance);
    const unwatchSettings = settingsItem.watch((next) => {
      settings = next;
      refresh();
    });
    const unwatchPlanner = plannerItem.watch((next) => { planner = normalizePlannerData(next); refresh(); });
    ctx.onInvalidated(() => {
      observer.disconnect();
      unwatchSettings();
      unwatchPlanner();
    });
    if (import.meta.env.DEV) {
      const capture = document.createElement('button');
      capture.type = 'button';
      capture.className = 'ae-fixture-capture';
      capture.textContent = 'Capture Sanitized Fixture';
      capture.addEventListener('click', () => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([captureSanitizedFixture(document)], { type: 'text/html' }));
        link.download = `albert-fixture-${new Date().toISOString().slice(0, 10)}.html`;
        link.click();
        URL.revokeObjectURL(link.href);
      });
      document.body.append(capture);
    }
  },
});
