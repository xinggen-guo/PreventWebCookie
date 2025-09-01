import {ensureDefaults, getSettings, getStats, saveSettings, bumpStat} from './settings.js';
import {initCookiePruning, applyThirdPartyPolicy} from './cookies.js';
import {initDynamicRules} from './dnr.js';

/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

ensureDefaults().then(async () => {
    const s = await getSettings();
    await applyThirdPartyPolicy(s.block3p);
    initCookiePruning();
    await initDynamicRules();
});

chrome.runtime.onMessage.addListener((msg, sender, send) => {
    (async () => {
        if (msg.type === 'GET_SUMMARY') {
            const [s, st] = await Promise.all([getSettings(), getStats()]);
            send({settings: s, stats: st, tab: sender?.tab});
        } else if (msg.type === 'SET_BLOCK_3P') {
            const s = await getSettings();
            s.block3p = !!msg.value;
            await applyThirdPartyPolicy(s.block3p);
            await saveSettings(s);
            send({ok: true});
        } else if (msg.type === 'TOGGLE_PAUSE') {
            const s = await getSettings();
            const host = msg.host;
            s.pauseMap[host] = !s.pauseMap[host];
            await saveSettings(s);
            send({ok: true, paused: s.pauseMap[host]});
        } else if (msg.type === 'BANNER_HANDLED') {
            await bumpStat('bannersHandled', 1);
            send({ok: true});
        }
    })();
    return true;
});
