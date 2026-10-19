import { defineContentScript } from 'wxt/utils/define-content-script';
import { findSessionExpiryControl, sessionResetUrl } from '../adapters/albert/sessionKeeper';
import { ALBERT_SELECTORS } from '../adapters/albert/selectors';
import {
  albertDescriptionSearchEvent,
  albertMainBridgeReadyEvent,
  albertSessionConfirmEvent,
  albertSelectTermEvent,
  albertTitleSearchEvent,
} from '../adapters/albert/searchBridge';

type AlbertWindow = typeof window & {
  resetAutoSave?: () => void;
  submitAction_win0?: (form: HTMLFormElement, actionId: string) => void;
  IS?: { SSS?: { ShopCartTermSelect?: (tab: HTMLAnchorElement) => void } };
  makeTablesResponsivePostLoad?: (root: Element) => void;
  DisplayToggleButton?: (term: string) => void;
};

export default defineContentScript({
  matches: ['https://*.nyu.edu/*'],
  allFrames: true,
  world: 'MAIN',
  main() {
    const submit = (actionId: 'BUTTON_SMALL' | 'SMALL_BUTTON'): void => {
      const form = document.forms.namedItem('win0');
      const submitAction = (window as AlbertWindow).submitAction_win0;
      if (form !== null && typeof submitAction === 'function') submitAction(form, actionId);
    };
    document.addEventListener(albertTitleSearchEvent, () => submit('BUTTON_SMALL'));
    document.addEventListener(albertDescriptionSearchEvent, () => submit('SMALL_BUTTON'));
    document.addEventListener(albertSelectTermEvent, (event: Event) => {
      const tab = event.target;
      if (!(tab instanceof HTMLAnchorElement) || !tab.matches(ALBERT_SELECTORS.semesterTab)) return;
      if (tab.closest('[hidden], [inert], [aria-hidden="true"]') !== null || tab.getAttribute('aria-disabled') === 'true') return;
      const group = tab.parentElement;
      const term = /^isSSS_ShCtTm(\d{4}[A-Z]+)$/.exec(tab.dataset.termclass ?? '')?.[1];
      if (group === null || term === undefined || tab.id !== `IS_SSS_ShCtTm${term}Lnk`) return;
      const page = window as AlbertWindow;
      const sss = page.IS?.SSS;
      if (typeof sss?.ShopCartTermSelect !== 'function'
        || typeof page.makeTablesResponsivePostLoad !== 'function'
        || typeof page.DisplayToggleButton !== 'function') return;
      sss.ShopCartTermSelect(tab);
      page.makeTablesResponsivePostLoad(group);
      page.DisplayToggleButton(term);
      event.preventDefault();
    });
    document.addEventListener(albertSessionConfirmEvent, () => {
      const control = findSessionExpiryControl(document);
      if (control === undefined) return;
      const resetUrl = sessionResetUrl(control, window.location.href);
      if (resetUrl === undefined) return;
      document.documentElement.dataset.aeSessionPromptHandled = 'true';
      try {
        const opener = window.opener as AlbertWindow | null;
        if (typeof opener?.resetAutoSave === 'function') opener.resetAutoSave();
      } catch {
        // A cross-origin opener can be inaccessible; resetting the timeout URL is sufficient.
      }
      window.location.assign(resetUrl);
      window.close();
    });
    document.documentElement.dataset.aeMainBridgeReady = 'true';
    document.dispatchEvent(new Event(albertMainBridgeReadyEvent));
  },
});
