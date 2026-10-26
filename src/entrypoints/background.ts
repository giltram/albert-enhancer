import { createStorageWriter } from '../storage/writer';
import type { StorageCommand } from '../storage/commands';

export default defineBackground(() => {
  const write = createStorageWriter();
  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
    if (['update-planner', 'update-degree', 'clear-local-data'].includes(String(message.type))) {
      if (sender.id !== browser.runtime.id) return;
      void write(message as StorageCommand).then(sendResponse);
      return true;
    }
    if (message.type === 'open-schedule-lab') {
      return browser.tabs.create({ url: browser.runtime.getURL('/planner.html') });
    }
    if (message.type === 'open-degree-planner') {
      return browser.tabs.create({ url: browser.runtime.getURL('/degree.html') });
    }
    if (message.type === 'open-settings') {
      return browser.tabs.create({ url: browser.runtime.getURL('/options.html') });
    }
  });
});
