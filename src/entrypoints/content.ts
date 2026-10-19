import { captureSanitizedFixture, collectCampusOptions, confirmSessionExpiry, enhanceAlbertPage } from '../adapters/albert';
import { settingsItem } from '../storage/settings';
import { normalizePlannerData, plannerItem } from '../storage/planner';
import { campusOptionsItem } from '../storage/campuses';
import { albertMainBridgeReadyEvent } from '../adapters/albert/searchBridge';
import '../adapters/albert/enhancements.css';

export default defineContentScript({
  matches: ['https://*.nyu.edu/*'],
  allFrames: true,
  async main() {
    document.documentElement.dataset.albertEnhancer = 'active';
    let settings = await settingsItem.getValue();
    let planner = normalizePlannerData(await plannerItem.getValue());
    let lastCampusOptions = JSON.stringify(await campusOptionsItem.getValue());
    const enhance = (): void => {
      confirmSessionExpiry(document, settings.keepSessionAlive);
      enhanceAlbertPage(document, settings, planner);
      const campusOptions = collectCampusOptions(document);
      const serialized = JSON.stringify(campusOptions);
      if (campusOptions.length > 0 && serialized !== lastCampusOptions) {
        lastCampusOptions = serialized;
        void campusOptionsItem.setValue(campusOptions);
      }
    };
    const refresh = (): void => {
      for (const panel of document.querySelectorAll('[data-ae-enhancement]')) panel.remove();
      enhance();
    };
    enhance();
    const observer = new MutationObserver(enhance);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener(albertMainBridgeReadyEvent, enhance);
    settingsItem.watch((next) => {
      settings = next;
      refresh();
    });
    plannerItem.watch((next) => { planner = normalizePlannerData(next); refresh(); });
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
