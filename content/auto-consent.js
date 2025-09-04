/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

(async () => {
    const { logger }   = await import(chrome.runtime.getURL('util/Logger.js'));
    const common     = await import(chrome.runtime.getURL('content/detectors/common.js'));
    const oneTrustMd = await import(chrome.runtime.getURL('content/detectors/oneTrust.js'));
    const didomiMd   = await import(chrome.runtime.getURL('content/detectors/didomi.js'));

    const { OneTrustAdapter } = oneTrustMd;
    const { DidomiAdapter }   = didomiMd;

    const adapters = [OneTrustAdapter, DidomiAdapter];
    const { tryHeuristics: tryHeuristicsFromCommon } = common;

    let stopped = false;
    let inflight = false;

    async function tryAdapters() {
        for (const a of adapters) {
            try {
                logger.log('[CS] auto-consent.js a',a);
                if (a.detect(document)) {
                    const ok = await a.reject(document);
                    if (ok) return true;
                }
            } catch {}
        }
        return false;
    }
    async function tryHeuristics() {
        try {
            return await tryHeuristicsFromCommon();
        } catch (e) {
            logger.debug('[CS] heuristic error', e);
            return false;
        }
    }
    async function work() {
        if (stopped || inflight) return;
        inflight = true;
        let ok = await tryAdapters();
        if (!ok) ok = await tryHeuristics();
        if (ok) {
            logger.log('[CS] auto-consent.js BANNER_HANDLED', ok);
            chrome.runtime.sendMessage({ type: 'BANNER_HANDLED' });
            stopped = true;
        } else {
            logger.log('[CS] no banner / no reject button, skip');
        }
        inflight = false;
    }
    const mo = new MutationObserver(work);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(work, 600);
    setInterval(work, 1500);

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'PAUSE_CONTENT') stopped = true;
    });
})();
