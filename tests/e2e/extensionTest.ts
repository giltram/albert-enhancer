import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'node:path';
export { expect } from '@playwright/test';

const extensionPath = path.resolve('.output/chrome-mv3');
export const test = base.extend<{ planner: Page }, { extensionContext: BrowserContext; extensionId: string }>({
  extensionContext: [async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: true,
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await use(context);
    await context.close();
  }, { scope: 'worker' }],
  extensionId: [async ({ extensionContext }, use) => {
    let [worker] = extensionContext.serviceWorkers();
    worker ??= await extensionContext.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  }, { scope: 'worker' }],
  planner: async ({ extensionContext, extensionId }, use) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/planner.html`);
    await use(page);
    await page.close();
  },
});

