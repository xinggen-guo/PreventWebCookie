/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

const KEY_SETTINGS = 'guard_settings';
const KEY_STATS    = 'guard_stats';

const DEFAULTS = {
  enabled: true,
  pauseMap: {},
  allowList: ["^.*\\.example-required\\.com$"],
  patterns: [ "reject all", "deny all", "only essential", "仅.*必要", "拒绝.*全部" ],
  block3p: true
};

export async function ensureDefaults() {
  const [s, t] = await Promise.all([
    chrome.storage.sync.get(KEY_SETTINGS),
    chrome.storage.local.get(KEY_STATS)
  ]);
  if (!s[KEY_SETTINGS]) await chrome.storage.sync.set({ [KEY_SETTINGS]: DEFAULTS });
  if (!t[KEY_STATS])    await chrome.storage.local.set({ [KEY_STATS]: { cookiesRemoved:0, bannersHandled:0 } });
}

export async function getSettings() {
  const { [KEY_SETTINGS]: s } = await chrome.storage.sync.get(KEY_SETTINGS);
  return s || DEFAULTS;
}

export async function saveSettings(s) {
  await chrome.storage.sync.set({ [KEY_SETTINGS]: s });
}

export async function getStats() {
  const { [KEY_STATS]: st } = await chrome.storage.local.get(KEY_STATS);
  return st || { cookiesRemoved:0, bannersHandled:0 };
}

export async function bumpStat(key, inc = 1) {
  const st = await getStats();
  st[key] = (st[key] || 0) + inc;
  await chrome.storage.local.set({ [KEY_STATS]: st });
}
