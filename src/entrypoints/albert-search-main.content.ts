import { findSessionExpiryControl, sessionResetUrl } from '../adapters/albert/sessionKeeper';
import {
  albertDescriptionSearchEvent,
  albertMainBridgeReadyEvent,
  albertSessionConfirmEvent,
  albertTitleSearchEvent,
} from '../adapters/albert/searchBridge';

type AlbertWindow = typeof window & {
  resetAutoSave?: () => void;
  submitAction_win0?: (form: HTMLFormElement, actionId: string) => void;
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
