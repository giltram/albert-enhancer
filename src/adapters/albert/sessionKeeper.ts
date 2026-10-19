import { albertSessionConfirmEvent } from './searchBridge';

const sessionExpiryPattern = /(?:\bsession\b.{0,100}(?:about to|will|is going to).{0,60}(?:expire|time out|timeout))|(?:(?:expire|time out|timeout).{0,100}\bsession\b)/i;

function controlLabel(control: Element): string {
  if (control instanceof HTMLInputElement) return control.value.trim();
  return control.textContent?.trim() ?? '';
}

export function findSessionExpiryControl(root: Document): HTMLElement | undefined {
  const pageText = root.body?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  if (!sessionExpiryPattern.test(pageText)) return undefined;
  const okay = [...root.querySelectorAll('button, input[type="button"], input[type="submit"], a[role="button"]')]
    .find((control) => /^ok$/i.test(controlLabel(control)));
  return okay instanceof HTMLElement ? okay : undefined;
}

/** Extracts only Albert's HTTPS reset-timeout target; the javascript: wrapper is never executed. */
export function sessionResetUrl(control: Element, pageUrl: string): string | undefined {
  const href = control.getAttribute('href') ?? '';
  const match = href.match(/(?:self\.)?location\s*=\s*(['"])(https:\/\/[^'"]+)\1/i);
  if (match?.[2] === undefined) return undefined;
  let target: URL;
  try {
    target = new URL(match[2], pageUrl);
  } catch {
    return undefined;
  }
  const isNyu = target.hostname === 'nyu.edu' || target.hostname.endsWith('.nyu.edu');
  if (target.protocol !== 'https:' || !isNyu || target.searchParams.get('cmd') !== 'resettimeout') return undefined;
  return target.href;
}

/** Requests confirmation in Albert's MAIN world so its javascript: link is not blocked by extension CSP. */
export function confirmSessionExpiry(root: Document, enabled: boolean): boolean {
  if (!enabled || root.documentElement.dataset.aeSessionPromptHandled === 'true') return false;
  if (root.documentElement.dataset.aeMainBridgeReady !== 'true') return false;
  if (findSessionExpiryControl(root) === undefined) return false;
  root.dispatchEvent(new Event(albertSessionConfirmEvent));
  return true;
}
