// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { confirmSessionExpiry, findSessionExpiryControl, sessionResetUrl } from '../../src/adapters/albert/sessionKeeper';
import { albertSessionConfirmEvent } from '../../src/adapters/albert/searchBridge';

describe('Albert session timeout helper', () => {
  it('recognizes the captured warning and delegates it to the MAIN-world bridge', () => {
    document.documentElement.innerHTML = readFileSync('tests/fixtures/albert/timeout-warning.html', 'utf8');
    document.documentElement.removeAttribute('data-ae-session-prompt-handled');
    document.documentElement.dataset.aeMainBridgeReady = 'true';
    const delegated = vi.fn(() => { document.documentElement.dataset.aeSessionPromptHandled = 'true'; });
    document.addEventListener(albertSessionConfirmEvent, delegated, { once: true });
    expect(confirmSessionExpiry(document, true)).toBe(true);
    expect(delegated).toHaveBeenCalledOnce();
    expect(confirmSessionExpiry(document, true)).toBe(false);

    const control = findSessionExpiryControl(document)!;
    expect(control.id).toBe('msgokbutton');
    expect(sessionResetUrl(control, document.URL)).toBe('https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/?cmd=resettimeout');
  });

  it('does nothing when disabled or when an ordinary page happens to have an OK button', () => {
    document.documentElement.removeAttribute('data-ae-session-prompt-handled');
    document.documentElement.dataset.aeMainBridgeReady = 'true';
    document.body.innerHTML = '<p>Settings saved.</p><button>OK</button>';
    const delegated = vi.fn();
    document.addEventListener(albertSessionConfirmEvent, delegated, { once: true });
    expect(confirmSessionExpiry(document, false)).toBe(false);
    expect(confirmSessionExpiry(document, true)).toBe(false);
    expect(delegated).not.toHaveBeenCalled();
  });

  it('rejects a reset target outside NYU', () => {
    document.body.innerHTML = `<p>Your session is about to expire.</p>
      <a role="button" href="javascript:self.location='https://example.com/?cmd=resettimeout'">OK</a>`;
    expect(sessionResetUrl(findSessionExpiryControl(document)!, document.URL)).toBeUndefined();
  });
});
