import type { Page } from '@playwright/test';
import { expect, test } from './extensionTest';

declare const chrome: {
  storage: { local: { get(key: string): Promise<Record<string, unknown>>; set(value: unknown): Promise<void>; remove(key: string): Promise<void> } };
};

function abbreviationRow(page: Page, abbreviation: string) {
  return page.locator('.abbreviation-row').filter({
    has: page.locator(`input[value="${abbreviation}"]`),
  });
}

async function expectSearch(page: Page, query: string, expansion: string): Promise<void> {
  // Settings notifications arrive asynchronously in the already-open search tab.
  await expect(async () => {
    const title = page.locator('#NYU_CLS_DERIVED_DESCR100');
    await title.fill(query);
    await title.press('Enter');
    await expect(title).toHaveValue(expansion);
    await expect(page.locator('#submitted')).toHaveText(expansion);
    const description = page.locator('#NYU_CLS_DERIVED_DESCR100_JOB_POST1');
    await description.fill(query);
    await page.locator('#SMALL_BUTTON').click();
    await expect(description).toHaveValue(expansion);
  }).toPass({ timeout: 5_000 });
}

test('adding and deleting abbreviations updates saved settings and open searches', async ({ extensionContext, extensionId }, testInfo) => {
  const settings = await extensionContext.newPage();
  const search = await extensionContext.newPage();
  const [worker] = extensionContext.serviceWorkers();
  const previousSettings = await worker!.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  try {
    await worker!.evaluate(async () => { await chrome.storage.local.remove('settings'); });
    await search.addInitScript(() => {
      Object.assign(window, {
        submitAction_win0: () => {
          document.querySelector('#submitted')!.textContent = document.querySelector<HTMLInputElement>('#NYU_CLS_DERIVED_DESCR100')!.value;
        },
      });
    });
    await search.route('https://test.nyu.edu/abbreviation-search', (route) => route.fulfill({
      contentType: 'text/html',
      body: '<form name="win0"><input id="NYU_CLS_DERIVED_DESCR100"><button type="button" id="BUTTON_SMALL">Search titles</button><input id="NYU_CLS_DERIVED_DESCR100_JOB_POST1"><button type="button" id="SMALL_BUTTON">Search descriptions</button><output id="submitted"></output></form>',
    }));
    await settings.goto(`chrome-extension://${extensionId}/options.html`);
    await search.goto('https://test.nyu.edu/abbreviation-search');
    await expect(search.locator('#NYU_CLS_DERIVED_DESCR100')).toHaveAttribute('data-ae-abbreviation-search', 'true');
    await expectSearch(search, 'dl', 'Digital Logic');

    await test.step('add a new abbreviation and persist it', async () => {
      await settings.getByRole('button', { name: 'Add abbreviation' }).click();
      const newRow = settings.locator('.abbreviation-row').last();
      await newRow.getByRole('textbox').nth(0).fill('ZTEST');
      await newRow.getByRole('textbox').nth(1).fill('Temporary Course');
      await settings.getByRole('button', { name: 'Save settings' }).click();
      await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();
      await expectSearch(search, 'ztest', 'Temporary Course');
      await settings.reload();
      await expect(abbreviationRow(settings, 'ZTEST').getByRole('textbox').nth(1)).toHaveValue('Temporary Course');
      await search.reload();
      await expectSearch(search, 'ztest', 'Temporary Course');
    });

    await test.step('delete the newly added abbreviation', async () => {
      await abbreviationRow(settings, 'ZTEST').getByRole('button', { name: 'Delete' }).click();
      await settings.getByRole('button', { name: 'Save settings' }).click();
      await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();
      await expectSearch(search, 'ztest', 'ztest');
      await settings.reload();
      await expect(abbreviationRow(settings, 'ZTEST')).toHaveCount(0);
      await search.reload();
      await expectSearch(search, 'ztest', 'ztest');
      await expectSearch(search, 'dl', 'Digital Logic');
    });

    await test.step('delete a default abbreviation without restoring it on reload', async () => {
      await abbreviationRow(settings, 'DL').getByRole('button', { name: 'Delete' }).click();
      await settings.getByRole('button', { name: 'Save settings' }).click();
      await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();
      await expectSearch(search, 'dl', 'dl');
      await settings.reload();
      await expect(abbreviationRow(settings, 'DL')).toHaveCount(0);
      await search.reload();
      await expectSearch(search, 'dl', 'dl');
      await expectSearch(search, 'la', 'Linear Algebra');
      await settings.screenshot({ path: testInfo.outputPath('abbreviations-after-deletions.png'), fullPage: true });
    });
  } finally {
    await settings.close();
    await search.close();
    await worker!.evaluate(async (previous) => {
      if (previous === undefined) await chrome.storage.local.remove('settings');
      else await chrome.storage.local.set({ settings: previous });
    }, previousSettings);
  }
});
