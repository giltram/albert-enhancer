// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureHomeToolbar } from '../../src/adapters/albert/homeToolbar';

const extensionCss = readFileSync('src/styles/navigationButtons.css', 'utf8');
const nativeCss = readFileSync('tests/fixtures/albert/homepage-button-overrides.css', 'utf8');
const semesterFixture = readFileSync('tests/fixtures/albert/semester-tabs.html', 'utf8');

describe('navigation button styles on Albert', () => {
  afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });

  it('keeps home shortcuts identical to popup buttons despite Albert important overrides', () => {
    // jsdom 30 does not compare specificity between two !important declarations;
    // load host CSS first for computed-style checks. The next test checks priority.
    document.head.innerHTML = `<style>${nativeCss}</style><style>${extensionCss}</style>`;
    document.body.innerHTML = `${semesterFixture}<div class="ae-popup-navigation"><button class="ae-navigation-button">Settings</button></div>`;
    ensureHomeToolbar(document, { openScheduleLab: () => {}, openDegreePlanner: () => {}, openSettings: () => {} });
    const group = document.querySelector('.isSSS_FullW')!;
    const nativeButton = document.createElement('button');
    nativeButton.textContent = 'Albert native action';
    group.append(nativeButton);
    const popup = getComputedStyle(document.querySelector('.ae-popup-navigation button')!);
    const properties = ['background-color', 'color', 'border-top-width', 'border-top-style', 'border-radius', 'padding', 'font-weight', 'font-size', 'height', 'min-height', 'max-height'];
    const appearance = (style: CSSStyleDeclaration) => Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)]));
    expect(popup.backgroundColor).toBe('rgb(87, 6, 140)');
    expect(popup.borderRadius).toBe('3px');
    for (const button of document.querySelectorAll('[data-ae-home-toolbar] button')) {
      expect(appearance(getComputedStyle(button))).toEqual(appearance(popup));
    }
    const nativeStyle = getComputedStyle(nativeButton);
    expect(nativeStyle.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(nativeStyle.borderTopColor).toBe('rgb(0, 135, 105)');
    expect(nativeStyle.height).toBe('38px');
  });

  it('gives extension controls important overrides for each property locked by Albert', () => {
    document.head.innerHTML = `<style>${extensionCss}</style><style>${nativeCss}</style>`;
    const extensionRule = document.styleSheets[0]!.cssRules[0] as CSSStyleRule;
    const nativeRule = document.styleSheets[1]!.cssRules[0] as CSSStyleRule;
    // This explicit attribute scopes the stronger selector to injected controls.
    expect(extensionRule.selectorText).toContain('.ae-home-toolbar[data-ae-home-toolbar] > button.ae-navigation-button');
    for (const property of ['background', 'color', 'border', 'height', 'min-height', 'max-height']) {
      expect(nativeRule.style.getPropertyPriority(property)).toBe('important');
      expect(extensionRule.style.getPropertyPriority(property)).toBe('important');
    }
    expect(extensionRule.style.getPropertyPriority('font')).toBe('important');
  });
});
