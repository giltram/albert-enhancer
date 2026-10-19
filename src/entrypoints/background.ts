export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== 'object' || message === null || !('type' in message)) return;
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
