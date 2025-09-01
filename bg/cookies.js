/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

import { getSettings, bumpStat } from './settings.js';

function domainFromCookie(c) {
  return (c.domain || '').replace(/^\./, '');
}

export async function applyThirdPartyPolicy(disable3p) {
  await chrome.privacy.websites.thirdPartyCookiesAllowed.set({ value: !disable3p });
}

export function initCookiePruning() {
  chrome.cookies.onChanged.addListener(async ({ cookie, removed }) => {
    if (removed) return;
    const host = domainFromCookie(cookie);
    const url = (cookie.secure ? 'https://' : 'http://') + host + cookie.path;

    const settings = await getSettings();
    if (settings.pauseMap[host]) return;

    const allowed = (settings.allowList || []).some(rule => {
      try { const rx = new RegExp(rule, 'i'); return rx.test(host) || rx.test(url); }
      catch { return false; }
    });

    if (!allowed) {
      chrome.cookies.remove({ url, name: cookie.name }, async () => {
        await bumpStat('cookiesRemoved', 1);
      });
    }
  });
}
