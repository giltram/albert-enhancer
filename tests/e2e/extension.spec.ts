import { expect, test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

declare const chrome: {
  storage: { local: { get(key: string): Promise<Record<string, unknown>>; set(value: unknown): Promise<void>; remove(key: string): Promise<void> } };
};

const extensionPath = path.resolve('.output/chrome-mv3');
const test = base.extend<{ planner: Page }, { extensionContext: BrowserContext; extensionId: string }>({
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

test('planner renders its zero-result state', async ({ planner }) => {
  await expect(planner.getByRole('heading', { name: 'Schedule Lab' })).toBeVisible();
  await expect(planner.getByRole('heading', { name: 'No courses yet' })).toBeVisible();
});

test('fixture course can be added, simulated, undone, and removed', async ({ extensionContext, extensionId }) => {
  const albert = await extensionContext.newPage();
  await albert.route('https://test.nyu.edu/course', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<article data-ae-course>
      <h2 data-ae-field="course-code">CSCI-SHU 220</h2>
      <div data-ae-field="course-title">Algorithms</div>
      <div data-ae-field="section-code">001</div>
      <div data-ae-field="class-number">12345</div>
      <div data-ae-field="instructor">Professor X</div>
      <div data-ae-field="meeting">Tue / Thu · 14:00-15:15</div>
      <div data-ae-field="location">567 West Yangsi Rd, Shanghai Room EB224</div>
    </article>`,
  }));
  await albert.goto('https://test.nyu.edu/course');
  await albert.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(albert.getByRole('button', { name: 'Added' })).toBeVisible();

  const planner = await extensionContext.newPage();
  await planner.goto(`chrome-extension://${extensionId}/planner.html`);
  await expect(planner.getByRole('heading', { name: 'Your courses' })).toBeVisible();
  await expect(planner.locator('.course-title b').filter({ hasText: 'CSCI-SHU 220' })).toBeVisible();
  await expect(planner.getByLabel('Remove CSCI-SHU 220')).toHaveText('Remove');
  const calendarMeeting = planner.locator('.meeting[data-start-minute="840"]').first();
  await expect(calendarMeeting).toBeVisible();
  await expect(calendarMeeting.locator('small')).toHaveText('EB224');
  await expect(calendarMeeting).not.toContainText('567 West Yangsi Rd');
  expect(Number.parseFloat(await calendarMeeting.evaluate((element) => (element as HTMLElement).style.top))).toBeGreaterThan(40);

  const simulator = planner.locator('.simulation-options > div').filter({ hasText: 'CSCI-SHU 220:001' });
  await simulator.getByRole('button', { name: 'Got it' }).click();
  await expect(planner.getByText(/possibilities now/)).toBeVisible();
  await planner.getByRole('button', { name: 'Undo' }).click();
  await expect(planner.getByText('Last change undone')).toBeVisible();

  await planner.getByLabel('Remove CSCI-SHU 220').click();
  await expect(planner.getByRole('heading', { name: 'No courses yet' })).toBeVisible();
});

test('adding Wang machine learning from the second result preserves its course identity', async ({ extensionContext, extensionId }) => {
  const fixture = readFileSync('tests/fixtures/albert/logged-in-machine-learning.html', 'utf8');
  const albert = await extensionContext.newPage();
  await albert.route('https://sis.nyu.edu/machine-learning-results', (route) => route.fulfill({
    contentType: 'text/html', body: fixture,
  }));
  await albert.goto('https://sis.nyu.edu/machine-learning-results');
  const business = albert.locator('[id="win0divSELECT_COURSE_row$0"]');
  const machineLearning = albert.locator('[id="win0divSELECT_COURSE_row$1"]');
  const wang = machineLearning.locator('[id="win0divNYU_CLS_DTL_CLASS_NBR$3"]');
  const heading = machineLearning.locator('[id="win0divNYU_CLS_DERIVED_HTMLAREA$1"] > b');
  await expect(heading).toHaveText('CSCI-SHU 360 Machine Learning');
  await expect(business.locator('[data-kind="prerequisite"]')).toContainText('Business foundations.');
  await expect(wang.locator('[data-kind="prerequisite"]')).toContainText('Linear Algebra.');
  await wang.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(wang.getByRole('button', { name: 'Added' })).toBeDisabled();
  await expect(business.getByRole('button', { name: 'Add to Schedule Lab' })).toBeEnabled();
  await expect(heading).toHaveText('CSCI-SHU 360 Machine Learning');

  const planner = await extensionContext.newPage();
  await planner.goto(`chrome-extension://${extensionId}/planner.html`);
  await expect(planner.locator('.course-title b')).toHaveText('CSCI-SHU 360');
  await expect(planner.locator('.course-title span')).toHaveText('Machine Learning');
  await expect(planner.locator('.simulation-options')).toContainText('CSCI-SHU 360:003');
  await expect(planner.getByText('AI for Business', { exact: false })).toHaveCount(0);
  const [worker] = extensionContext.serviceWorkers();
  const stored = await worker!.evaluate(async () => (await chrome.storage.local.get('planner')).planner);
  expect(stored).toMatchObject({
    courses: [{ id: 'CSCI-SHU 360', title: 'Machine Learning' }],
    options: [{ id: 'CSCI-SHU 360:003', courseId: 'CSCI-SHU 360', instructors: [{ name: 'Wang, Shengjie' }], components: [{ classNumber: '18021' }] }],
  });

  // A second course with the same section code must remain independently addable.
  await business.getByRole('button', { name: 'Add to Schedule Lab' }).click();
  await expect(business.getByRole('button', { name: 'Added' })).toBeDisabled();
  await planner.reload();
  await expect(planner.locator('.course-title')).toHaveCount(2);
  await expect(planner.locator('.course-title').filter({ hasText: 'CSCI-SHU 360' }).locator('span')).toHaveText('Machine Learning');
  await planner.getByLabel('Remove CSCI-SHU 360').click();
  await planner.getByLabel('Remove BUSF-SHU 276').click();
  await albert.close();
  await planner.close();
});

test('multi-component courses are grouped and section actions preserve compatible bundles', async ({ extensionContext, extensionId }) => {
  const [worker] = extensionContext.serviceWorkers();
  await worker!.evaluate(async () => {
    await chrome.storage.local.set({ planner: {
      schemaVersion: 2,
      courses: [{ id: 'cs101', code: 'CSCI 101', title: 'Intro to Programming' }],
      intents: [{ courseId: 'cs101', required: true, requiredSectionIds: [], excludedSectionIds: [], preferredSectionIds: [] }],
      options: [
        {
          id: 'cs101::lec001+rec011', courseId: 'cs101', sectionIds: ['lec001', 'rec011'],
          meetings: [{ day: 'monday', startMinute: 600, endMinute: 675 }, { day: 'friday', startMinute: 600, endMinute: 650 }],
          instructors: [{ name: 'Professor Smith' }, { name: 'TA One' }],
          components: [
            { sectionId: 'lec001', componentType: 'lecture', sectionCode: '001', meetings: [{ day: 'monday', startMinute: 600, endMinute: 675 }], instructors: [{ name: 'Professor Smith' }] },
            { sectionId: 'rec011', componentType: 'recitation', sectionCode: '011', meetings: [{ day: 'friday', startMinute: 600, endMinute: 650 }], instructors: [{ name: 'TA One' }] },
          ],
        },
        {
          id: 'cs101::lec001+rec012', courseId: 'cs101', sectionIds: ['lec001', 'rec012'],
          meetings: [{ day: 'monday', startMinute: 600, endMinute: 675 }, { day: 'friday', startMinute: 780, endMinute: 830 }],
          instructors: [{ name: 'Professor Smith' }, { name: 'TA Two' }],
          components: [
            { sectionId: 'lec001', componentType: 'lecture', sectionCode: '001', meetings: [{ day: 'monday', startMinute: 600, endMinute: 675 }], instructors: [{ name: 'Professor Smith' }] },
            { sectionId: 'rec012', componentType: 'recitation', sectionCode: '012', meetings: [{ day: 'friday', startMinute: 780, endMinute: 830 }], instructors: [{ name: 'TA Two' }] },
          ],
        },
      ],
      registration: { present: { optionStatuses: {}, excludedOptionIds: [], sectionStatuses: {}, excludedSectionIds: [] }, past: [] },
      preferences: {
        preferredInstructors: {}, dislikedInstructors: {}, avoidFriday: false,
        weights: { professor: 1, time: 1, compactness: 1, daysOff: 1, robustness: 1, sectionPreference: 1 },
      },
    } });
  });
  const planner = await extensionContext.newPage();
  await planner.goto(`chrome-extension://${extensionId}/planner.html`);
  await expect(planner.getByRole('heading', { name: 'Lecture' })).toBeVisible();
  await expect(planner.getByRole('heading', { name: 'Recitation' })).toBeVisible();
  await expect(planner.locator('.header-stat b')).toHaveText('2');
  const recitation = planner.locator('.component-row').filter({ hasText: 'REC 012' });
  await recitation.getByRole('button', { name: 'Exclude' }).click();
  await expect(planner.locator('.header-stat b')).toHaveText('1');
  await expect(planner.locator('.candidate-components')).toContainText('REC 011');
  const simulator = planner.locator('.simulation-options > div').filter({ hasText: 'REC 011' });
  await simulator.getByRole('button', { name: 'Full' }).click();
  await expect(planner.locator('.header-stat b')).toHaveText('0');
  await planner.close();
  await worker!.evaluate(async () => { await chrome.storage.local.remove('planner'); });
});

test('settings persist and expose configurable highlights', async ({ extensionContext, extensionId }) => {
  const page = await extensionContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await expect(page.getByText('ALBERT ENHANCER · v0.1.5')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Course highlights' })).toBeVisible();
  await page.getByRole('button', { name: 'Add abbreviation' }).click();
  await page.getByLabel('Abbreviation 1').fill('AI');
  await page.getByLabel('Expansion 1').fill('Artificial Intelligence');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible();
});

test('default semester persists, applies on opening, and preserves manual tab changes', async ({ extensionContext, extensionId }) => {
  const settings = await extensionContext.newPage();
  const albert = await extensionContext.newPage();
  const [worker] = extensionContext.serviceWorkers();
  const previousSettings = await worker!.evaluate(async () => (await chrome.storage.local.get('settings')).settings);
  try {
    await settings.goto(`chrome-extension://${extensionId}/options.html`);
    await settings.getByLabel('Default semester', { exact: true }).fill('spring 2027');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();
    await settings.reload();
    await expect(settings.getByLabel('Default semester', { exact: true })).toHaveValue('spring 2027');

    const fixture = readFileSync(path.resolve('tests/fixtures/albert/semester-tabs.html'), 'utf8');
    await albert.route('https://test.nyu.edu/semester-tabs', (route) => route.fulfill({ contentType: 'text/html', body: fixture }));
    await albert.goto('https://test.nyu.edu/semester-tabs');
    await expect(albert.locator('#selected-semester')).toHaveText('Spring 2027');
    await albert.getByRole('link', { name: 'Fall 2026', exact: true }).click();
    await expect(albert.locator('#selected-semester')).toHaveText('Fall 2026');
    await albert.reload();
    await expect(albert.locator('#selected-semester')).toHaveText('Spring 2027');

    await settings.getByLabel('Default semester', { exact: true }).fill('Spring 2028');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();
    await albert.reload();
    await expect(albert.locator('#selected-semester')).toHaveText('Fall 2026');

    await settings.getByLabel('Default semester', { exact: true }).fill('');
    await settings.getByRole('button', { name: 'Save settings' }).click();
    await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();
    await albert.reload();
    await expect(albert.locator('#selected-semester')).toHaveText('Fall 2026');
  } finally {
    await settings.close();
    await albert.close();
    await worker!.evaluate(async (previous) => {
      if (previous === undefined) await chrome.storage.local.remove('settings');
      else await chrome.storage.local.set({ settings: previous });
    }, previousSettings);
  }
});

test('degree planner adds and moves a planned course', async ({ extensionContext, extensionId }) => {
  const page = await extensionContext.newPage();
  await page.goto(`chrome-extension://${extensionId}/degree.html`);
  await page.getByLabel('Course code').fill('CSCI-SHU 101');
  await page.getByLabel('Course title').fill('Introduction to Computer Science');
  await page.getByLabel('Term').fill('Fall 2027');
  await page.getByRole('button', { name: 'Add planned course' }).click();
  const card = page.locator('article').filter({ hasText: 'CSCI-SHU 101' }).first();
  await expect(card).toContainText('Fall 2027');
  await card.dragTo(page.locator('.column[data-progress="taken"]'), {
    sourcePosition: { x: 10, y: 10 },
    targetPosition: { x: 20, y: 80 },
  });
  await expect(page.getByLabel('CSCI-SHU 101 status')).toHaveValue('taken');
});

test('logged-in Albert Course Search iframe receives its actions and opens the real settings page', async ({ extensionContext }) => {
  const albert = await extensionContext.newPage();
  await albert.addInitScript(() => {
    Object.assign(window, {
      submitAction_win0: (_form: HTMLFormElement, actionId: string) => {
        const output = document.querySelector('#search-ran');
        if (output !== null) output.textContent = actionId;
      },
    });
  });
  await albert.route('https://sis.nyu.edu/fixture-course-search', (route) => route.fulfill({
    contentType: 'text/html',
    headers: { 'content-security-policy': "script-src 'self'" },
    body: `<form name="win0" id="NYU_CLS_SRCH"><div id="win0div$ICField114" class="ps_apps_content" style="height:320px;overflow:auto"><div id="win0divNYU_CLASS_SEARCH">
      <div id="SEARCH"><div id="SEARCHgrp"><label for="NYU_CLS_DERIVED_DESCR100">Subject, Catalog Number,Title &amp; Instructor Names</label><input id="NYU_CLS_DERIVED_DESCR100"><a id="BUTTON_SMALL" role="button" href="javascript:submitAction_win0(document.win0,'BUTTON_SMALL');">Search</a><output id="search-ran"></output></div></div>
      <select id="NYU_CLS_WRK2_DESCR254$33$"><option value=""> </option><option value="NYU Shanghai">NYU Shanghai</option></select>
      <div id="win0divRESULTS"><div style="height:280px">Earlier search results</div><div id="win0divSELECT_COURSE_row$0">
        <div id="win0divNYU_CLS_DERIVED_HTMLAREA$0"><b>CENG-SHU 201 Digital Logic</b></div>
        <div id="win0divNYU_CLS_DTL_CLASS_NBR$0"><div><b>CENG-SHU 201</b> | 4 units</div><div id="COURSE7694nyu">
          <div><b>Class#:</b> 7694</div><div><b>Section:</b> 001</div><div><b>Course Location:</b> Shanghai</div><div><b>Component:</b> Lecture</div>
        </div><br>Fri 5.15 PM - 6.30 PM at New Bund Campus with Zhou, Wen</div>
      </div></div>
    </div></div></form>`,
  }));
  await albert.route('https://test.nyu.edu/albert', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<iframe id="lbFrameContent" src="https://sis.nyu.edu/fixture-course-search"></iframe>',
  }));
  await albert.goto('https://test.nyu.edu/albert');
  const search = albert.frameLocator('#lbFrameContent');
  await expect(search.getByText('Albert Enhancer', { exact: true })).toBeVisible();
  await expect(search.getByText('v0.1.5', { exact: true })).toBeVisible();
  await expect(search.getByText('Auto School: Off', { exact: true })).toBeVisible();
  const searchQuery = search.getByLabel('Subject, Catalog Number,Title & Instructor Names');
  await searchQuery.fill('wAi');
  await searchQuery.press('Enter');
  await expect(searchQuery).toHaveValue('Writing as Inquiry');
  await expect(search.getByText('BUTTON_SMALL', { exact: true })).toBeVisible();
  await expect(search.getByRole('button', { name: 'Add to Schedule Lab' })).toBeVisible();
  await expect(search.getByRole('button', { name: 'Copy Class Number' })).toBeVisible();
  const resultSpacer = search.locator('[data-ae-results-end-spacer]');
  await expect(resultSpacer).toHaveCSS('height', '112px');
  await resultSpacer.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  const bottomClearance = await search.getByRole('button', { name: 'Copy Class Number' }).evaluate((button) => {
    const scroller = button.closest('.ps_apps_content')!;
    return scroller.getBoundingClientRect().bottom - button.getBoundingClientRect().bottom;
  });
  expect(bottomClearance).toBeGreaterThan(80);
  const settingsPagePromise = extensionContext.waitForEvent('page');
  await search.getByRole('button', { name: 'School & abbreviation settings' }).click();
  const settingsPage = await settingsPagePromise;
  await expect(settingsPage.getByRole('heading', { name: 'School preference' })).toBeVisible();
  await expect(settingsPage.getByRole('heading', { name: 'Custom abbreviations' })).toBeVisible();
});

test('session timeout helper clicks only the enabled expiry warning', async ({ extensionContext, extensionId }) => {
  const settings = await extensionContext.newPage();
  await settings.goto(`chrome-extension://${extensionId}/options.html`);
  await settings.getByLabel('Automatically click OK on Albert session-expiry warning windows').check();
  await settings.getByRole('button', { name: 'Save settings' }).click();
  await expect(settings.getByRole('button', { name: 'Saved' })).toBeVisible();

  const timeoutUrl = 'https://sis.portal.nyu.edu/psc/ihprod/EMPLOYEE/EMPL/s/WEBLIB_TIMEOUT.PT_TIMEOUTWARNING.FieldFormula.IScript_TIMEOUTWARNING';
  const timeoutFixture = readFileSync(path.resolve('tests/fixtures/albert/timeout-warning.html'), 'utf8');
  await extensionContext.route(timeoutUrl, (route) => route.fulfill({
    contentType: 'text/html',
    body: timeoutFixture,
  }));
  await extensionContext.route('https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/?cmd=resettimeout', (route) => route.fulfill({
    contentType: 'text/html', body: '<p>Session renewed</p>',
  }));

  const launcher = await extensionContext.newPage();
  await launcher.route('https://sis.portal.nyu.edu/launcher', (route) => route.fulfill({ contentType: 'text/html', body: '<p>Albert</p>' }));
  await launcher.goto('https://sis.portal.nyu.edu/launcher');
  await launcher.evaluate(() => {
    Object.assign(window, { resetAutoSave: () => { document.body.dataset.timeoutReset = 'true'; } });
  });
  const warningPromise = extensionContext.waitForEvent('page');
  await launcher.evaluate((url) => { window.open(url, 'albert-timeout', 'width=560,height=300'); }, timeoutUrl);
  const warning = await warningPromise;
  await expect(launcher.locator('body')).toHaveAttribute('data-timeout-reset', 'true');
  await expect.poll(() => warning.isClosed()).toBe(true);
});
