import { readFileSync } from 'node:fs';
import { expect, test } from './extensionTest';
import type { PlannerData } from '../../src/storage/plannerData';

declare const chrome: {
  storage: { local: { get(key: string): Promise<Record<string, unknown>>; remove(key: string): Promise<void> } };
};

// This reduced captured DOM omits the semester controls. The replay supplies its
// documented source semester explicitly, without changing the captured markup.
function springMachineLearningFixture(): string {
  return `<main data-ae-term="Spring 2027">${readFileSync('tests/fixtures/albert/logged-in-machine-learning.html', 'utf8')}</main>`;
}

test.beforeEach(async ({ extensionContext }) => {
  const [worker] = extensionContext.serviceWorkers();
  const background = worker ?? await extensionContext.waitForEvent('serviceworker');
  await background.evaluate(async () => { await chrome.storage.local.remove('planner'); });
});

test('both Machine Learning lectures automatically include their own recitation', async ({ extensionContext, extensionId }) => {
  const page = await extensionContext.newPage();
  await page.route('https://sis.nyu.edu/linked-machine-learning', (route) => route.fulfill({ contentType: 'text/html', body: springMachineLearningFixture() }));
  await page.goto('https://sis.nyu.edu/linked-machine-learning');
  const lecture = (index: number) => page.locator(`[id="win0divNYU_CLS_DTL_CLASS_NBR$${index}"]`);
  await expect(lecture(2).getByRole('button', { name: 'Add to Schedule Lab' })).toHaveCount(0);
  await expect(lecture(4).getByRole('button', { name: 'Add to Schedule Lab' })).toHaveCount(0);
  await lecture(3).getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(lecture(3).getByRole('button', { name: 'Added' })).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await lecture(1).getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(lecture(1).getByRole('button', { name: 'Added' })).toBeDisabled();
  const [worker] = extensionContext.serviceWorkers();
  const stored = await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner) as PlannerData;
  expect(stored.options.map((option) => option.sectionIds)).toEqual([
    ['CSCI-SHU 360:003', 'CSCI-SHU 360:004'], ['CSCI-SHU 360:001', 'CSCI-SHU 360:002'],
  ]);
  const planner = await extensionContext.newPage();
  await planner.goto(`chrome-extension://${extensionId}/planner.html`);
  await expect(planner.locator('.header-stat b')).toHaveText('2');
  await expect(planner.locator('.candidate-components > article > div')).toHaveCount(2);
  await expect(planner.locator('.meeting.component-recitation')).toHaveCount(1);
  await page.close();
  await planner.close();
});

for (const keep of [1, 2, 6]) {
  test(`programming picker keeps ${keep} alternative labs and the timetable uses one`, async ({ extensionContext, extensionId }, testInfo) => {
    const page = await extensionContext.newPage();
    await page.route('https://sis.nyu.edu/linked-programming', (route) => route.fulfill({ contentType: 'text/html', body: readFileSync('tests/fixtures/albert/linked-programming.html', 'utf8') }));
    await page.goto('https://sis.nyu.edu/linked-programming');
    await expect(page.getByRole('button', { name: 'Add to Schedule Lab' })).toHaveCount(1);
    const add = page.getByRole('button', { name: 'Add to Schedule Lab' });
    await add.click();
    const dialog = page.getByRole('dialog', { name: 'Keep recitation / lab options' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Uncheck only those you definitely cannot attend');
    await expect(dialog).toContainText('even if they currently conflict with other courses in your plan');
    await expect(dialog).toContainText('Wed 12:45–14:35');
    await expect(dialog).toContainText('Feng, Jingyi');
    await expect(dialog).toContainText('Room EB122');
    await expect(dialog).toContainText('Instructor TBA');
    const checkboxes = dialog.getByRole('checkbox');
    await expect(checkboxes).toHaveCount(6);
    const selectAll = dialog.getByRole('button', { name: 'Select all', exact: true });
    await selectAll.click();
    await expect(dialog.locator('input:checked')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Add to Schedule Lab' })).toBeDisabled();
    await expect(dialog).toContainText('Keep at least one lab option.');
    await selectAll.click();
    await expect(dialog.locator('input:checked')).toHaveCount(6);
    for (let index = keep; index < 6; index += 1) await checkboxes.nth(index).uncheck();
    if (keep === 2) {
      await dialog.locator('.ae-picker-choices').evaluate((element) => { element.scrollTop = 0; });
      await page.screenshot({ path: testInfo.outputPath('lab-picker.png') });
    }
    await dialog.getByRole('button', { name: 'Add to Schedule Lab' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Added' })).toBeDisabled();
    const [worker] = extensionContext.serviceWorkers();
    const stored = await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner) as PlannerData;
    expect(stored.options).toHaveLength(keep);
    expect(stored.options.every((option) => option.components?.length === 2 && option.components.filter((component) => component.componentType === 'lab').length === 1)).toBe(true);
    const planner = await extensionContext.newPage();
    await planner.goto(`chrome-extension://${extensionId}/planner.html`);
    await expect(planner.locator('.header-stat b')).toHaveText(String(keep));
    await expect(planner.locator('.meeting.component-lab')).toHaveCount(1);
    await expect(planner.locator('.candidate-components > article > div')).toHaveCount(2);
    if (keep === 2) await planner.screenshot({ path: testInfo.outputPath('linked-schedule.png'), fullPage: true });
    await page.close();
    await planner.close();
  });
}

test('cancel and Escape leave storage unchanged and restore the add button', async ({ extensionContext }) => {
  const page = await extensionContext.newPage();
  await page.route('https://sis.nyu.edu/linked-programming', (route) => route.fulfill({ contentType: 'text/html', body: readFileSync('tests/fixtures/albert/linked-programming.html', 'utf8') }));
  await page.goto('https://sis.nyu.edu/linked-programming');
  const add = page.getByRole('button', { name: 'Add to Schedule Lab', exact: true });
  await add.click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(add).toBeEnabled();
  await expect(add).toBeFocused();
  await add.click();
  await page.getByRole('dialog').press('Escape');
  await expect(add).toBeEnabled();
  const [worker] = extensionContext.serviceWorkers();
  expect(await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner)).toBeUndefined();
  await page.close();
});

test('recitation and lab are independently required in the same picker', async ({ extensionContext }) => {
  const page = await extensionContext.newPage();
  const fixture = readFileSync('tests/fixtures/albert/linked-programming.html', 'utf8').replace('Component:</b> Laboratory', 'Component:</b> Recitation');
  await page.route('https://sis.nyu.edu/linked-programming', (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://sis.nyu.edu/linked-programming');
  await page.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  const dialog = page.getByRole('dialog');
  const recitations = dialog.getByRole('group', { name: 'Recitation · keep at least one' });
  const labs = dialog.getByRole('group', { name: 'Lab · keep at least one' });
  await labs.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(labs.locator('input:checked')).toHaveCount(0);
  await expect(recitations.getByRole('checkbox')).toBeChecked();
  await labs.getByRole('checkbox').first().check();
  await labs.getByRole('button', { name: 'Select all', exact: true }).click();
  await expect(labs.locator('input:checked')).toHaveCount(5);
  await dialog.getByRole('checkbox', { name: 'Recitation 002', exact: true }).uncheck();
  await expect(dialog.getByRole('button', { name: 'Add to Schedule Lab' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Recitation 002', exact: true }).check();
  await dialog.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(page.getByRole('button', { name: 'Added' })).toBeDisabled();
  const [worker] = extensionContext.serviceWorkers();
  const stored = await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner) as PlannerData;
  expect(stored.options).toHaveLength(5);
  expect(stored.options.every((option) => option.components?.length === 3)).toBe(true);
  await page.close();
});

test('filtered results do not save a lecture with hidden linked sections', async ({ extensionContext }) => {
  const page = await extensionContext.newPage();
  const fixture = '<label>Component: <select id="NYU_CLS_WRK_SSR_COMPONENT$27$"><option>Lecture</option></select></label>'
    + readFileSync('tests/fixtures/albert/linked-programming.html', 'utf8');
  await page.route('https://sis.nyu.edu/filtered-components', (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://sis.nyu.edu/filtered-components');
  await page.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Clear class filters' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add to Schedule Lab' })).toBeEnabled();
  const [worker] = extensionContext.serviceWorkers();
  expect(await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner)).toBeUndefined();
  await page.close();
});

test('a changed search invalidates a picker without importing stale sections', async ({ extensionContext }) => {
  const page = await extensionContext.newPage();
  const fixture = readFileSync('tests/fixtures/albert/linked-programming.html', 'utf8');
  await page.route('https://sis.nyu.edu/changing-components', (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://sis.nyu.edu/changing-components');
  await page.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  // Simulate Albert replacing a meeting in place while the modal is open.
  await page.locator('[id="win0divNYU_CLS_DTL_CLASS_NBR$1"]').evaluate((element) => { element.innerHTML = element.innerHTML.replace('Wed 12.45 PM', 'Wed 1.45 PM'); });
  await page.getByRole('dialog').getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Search results changed' })).toBeVisible();
  const [worker] = extensionContext.serviceWorkers();
  expect(await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner)).toBeUndefined();
  await page.close();
});

test('rapid imports in one document preserve both courses', async ({ extensionContext }) => {
  const page = await extensionContext.newPage();
  await page.route('https://sis.nyu.edu/concurrent-imports', (route) => route.fulfill({ contentType: 'text/html', body: springMachineLearningFixture() }));
  await page.goto('https://sis.nyu.edu/concurrent-imports');
  await expect(page.getByRole('button', { name: 'Add to Schedule Lab' })).toHaveCount(3);
  // Dispatch both user actions in one task before either storage read resolves.
  await page.evaluate(() => {
    for (const index of [0, 3]) document.getElementById(`win0divNYU_CLS_DTL_CLASS_NBR$${index}`)!.querySelector<HTMLButtonElement>('.ae-actions button')!.click();
  });
  await expect(page.getByRole('button', { name: 'Added' })).toHaveCount(2);
  const [worker] = extensionContext.serviceWorkers();
  const stored = await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner) as PlannerData;
  expect(stored.courses.map((course) => course.id).sort()).toEqual(['BUSF-SHU 276', 'CSCI-SHU 360']);
  expect(stored.options).toHaveLength(2);
  await page.close();
});

test('an incompatible automatic recitation never saves a lecture-only option or displays Added', async ({ extensionContext }) => {
  const page = await extensionContext.newPage();
  const fixture = springMachineLearningFixture()
    .replace('Fri 11.15 AM - 12.30 PM at Shanghai Room E204', 'Tue 12.45 PM - 2.00 PM at Shanghai Room E204');
  await page.route('https://sis.nyu.edu/incompatible-components', (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://sis.nyu.edu/incompatible-components');
  const wang = page.locator('[id="win0divNYU_CLS_DTL_CLASS_NBR$3"]');
  await wang.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(wang.getByRole('status')).toContainText('no compatible combination');
  await expect(wang.getByRole('button', { name: 'Add to Schedule Lab' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Added' })).toHaveCount(0);
  const [worker] = extensionContext.serviceWorkers();
  expect(await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner)).toBeUndefined();
  await page.close();
});
