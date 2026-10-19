import { readFileSync } from 'node:fs';
import { expect, test } from './extensionTest';

test('picker stays centered inside the Albert iframe despite the host margin reset', async ({ extensionContext }, testInfo) => {
  const page = await extensionContext.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.route('https://test.nyu.edu/picker-portal', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<style>body{margin:0;background:#ede9f0}iframe{position:absolute;left:40px;top:60px;width:calc(100% - 80px);height:calc(100% - 100px);border:0}</style><iframe title="Albert course search" src="https://sis.nyu.edu/picker-course-search"></iframe>',
  }));
  await page.route('https://sis.nyu.edu/picker-course-search', (route) => route.fulfill({
    contentType: 'text/html',
    // Actual universal reset from Albert's PSSTYLEDEF_FMODE_1.css.
    body: '<style>*{margin:0;padding:0}</style>' + readFileSync('tests/fixtures/albert/linked-programming.html', 'utf8'),
  }));
  await page.goto('https://test.nyu.edu/picker-portal');
  const search = page.frameLocator('iframe');
  await search.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  const dialog = search.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const assertCentered = async (): Promise<void> => {
    const offset = await dialog.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.abs(bounds.left + bounds.width / 2 - window.innerWidth / 2),
        y: Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2),
        bottom: bounds.bottom,
        height: window.innerHeight,
      };
    });
    expect(offset.x).toBeLessThan(1);
    expect(offset.y).toBeLessThan(1);
    expect(offset.bottom).toBeLessThanOrEqual(offset.height);
  };
  await assertCentered();
  await page.screenshot({ path: testInfo.outputPath('centered-picker.png') });
  await page.setViewportSize({ width: 900, height: 740 });
  await assertCentered();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.close();
});
