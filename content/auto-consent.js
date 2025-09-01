/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

(async () => {
    const common     = await import(chrome.runtime.getURL('content/detectors/common.js'));
    const oneTrustMd = await import(chrome.runtime.getURL('content/detectors/oneTrust.js'));
    const didomiMd   = await import(chrome.runtime.getURL('content/detectors/didomi.js'));

    const { matchByText, pickBestButton, safeClick } = common;
    const { OneTrustAdapter } = oneTrustMd;
    const { DidomiAdapter }   = didomiMd;

    const adapters = [OneTrustAdapter, DidomiAdapter];
    const defaultTexts = [/reject all/i, /deny all/i, /only essential/i, /仅.*必要/i, /拒绝.*全部/i];

    let stopped = false;

    async function tryAdapters() {
        for (const a of adapters) {
            try {
                if (a.detect(document)) {
                    const ok = await a.reject(document);
                    if (ok) return true;
                }
            } catch {}
        }
        return false;
    }
    async function tryHeuristics() {
        const btn = matchByText(defaultTexts) || pickBestButton(defaultTexts);
        return safeClick(btn);
    }
    async function work() {
        if (stopped) return;
        let ok = await tryAdapters();
        if (!ok) ok = await tryHeuristics();
        if (ok) {
            chrome.runtime.sendMessage({ type: 'BANNER_HANDLED' });
            stopped = true;
        }
    }
    const mo = new MutationObserver(work);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(work, 600);
    setInterval(work, 1500);

    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'PAUSE_CONTENT') stopped = true;
    });
})();
