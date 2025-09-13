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
    let needRescan = false;

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

        if(needRescan){
            logger.log('[CS] auto-consent.js, needRescan skip inflight',needRescan, stopped, inflight);
            if (stopped && !inflight) {
                stopped = false
                needRescan = false
            }else if(stopped || inflight){
                return
            }
        }

        if (stopped || inflight) {
            logger.log('[CS] auto-consent.js, skip inflight',stopped, inflight);
            return;
        }
        logger.log('[CS] auto-consent.js ----- 11111');
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
    mo.observe(document.documentElement, {childList: true,
        subtree: true,
        attributeFilter: ['class','style','hidden','aria-hidden','inert']}
    );
    setTimeout(work, 600);
    setInterval(work, 1500);

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'PAUSE_CONTENT') stopped = true;
    });

    window.addEventListener('online',  () => {
        console.log('[CS] 网络恢复，标记重新扫描');
        needRescan = true
    });

    window.addEventListener('offline', () => {
        console.log('[CS] 网络恢复，标记重新扫描');
        needRescan = true
    });

    if (navigator.connection && typeof navigator.connection.addEventListener === 'function') {
        navigator.connection.addEventListener('change', () => {
            console.log('[CS] 网络恢复，标记重新扫描');
            needRescan = true
        });
    }

    const origFetch = window.fetch;
    window.fetch = async (...args) => {
        const res = await origFetch(...args);
        res.clone().text().then(() => {
            needRescan = true
            console.log('[CS] fetch response, 标记重新扫描');
        });
        return res;
    };

    // patch XHR
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
        this.addEventListener('loadend', () => {
            needRescan = true
            console.log('[CS] XHR response, 标记重新扫描');
        });
        return origOpen.apply(this, args);
    };

})();
