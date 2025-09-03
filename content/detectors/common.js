/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */


// 关键词：容器要出现这些词之一
const BANNER_RE = /(cookie|consent|privacy|gdpr|同意|隐私|拒绝|仅.*必要)/i;

// 关键词：按钮必须出现这些“拒绝/仅必要”词之一
const REJECT_RE_LIST = [
     /reject all/i,
    /reject additional cookies/i,         // BBC
    /reject (non[- ]?essential|optional) cookies/i,
    /deny all/i,
    /only (essential|necessary|strictly necessary) cookies/i,
    /save (my )?choices/i,                // “Let me choose” 流程里常见的确认
    /仅.*必要/i, /拒绝.*全部/i
    ];

// 明确排除：典型导航/抽屉/汉堡菜单相关
const EXCLUDE_CONTAINER_RE = /(header|nav|menu|drawer|hamburger)/i;

export function scoreButton(el, rxList) {
  const text = (el.textContent || el.value || el.ariaLabel || '').trim();
  let s = 0;
  if (rxList.some(rx => rx.test(text))) s += 5;
  if (el.matches('button,[role="button"]')) s += 2;
  if (el.closest('[aria-modal="true"], [role="dialog"], .modal, .cmp, .cookie')) s += 1;
  return s;
}

export async function safeClick(el) {
  if (!el) return false;
  el.focus();
  el.click();
  await new Promise(r => setTimeout(r, 400));
  const stillModal = !!document.querySelector('[aria-modal="true"], [role="dialog"], .ot-sdk-container, #onetrust-banner-sdk');
  return !stillModal;
}
function normText(el) {
    const t = (el.textContent || el.value || el.getAttribute?.('aria-label') || '').trim();
    return t.replace(/\s+/g, ' ');
}

function isVisible(el) {
    if (!(el instanceof Element)) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
}

function closestBanner(el) {
    // 找最近的 dialog / 显著层（sticky/fixed）/ section 等
    return el.closest([
        '[role="dialog"]',
        '[aria-modal="true"]',
        'section', 'aside', 'div', 'form'
    ].join(','));
}

function looksLikeCookieBanner(node) {
    if (!node || !isVisible(node)) return false;
    const text = normText(node);
    if (!BANNER_RE.test(text)) return false;               // 必须含 cookie/consent 关键词
    if (EXCLUDE_CONTAINER_RE.test(node.className || '') ||
        EXCLUDE_CONTAINER_RE.test(node.id || '')) return false; // 排除导航类容器
    // 位置特征（常见：底/顶 fixed/sticky）
    const cs = getComputedStyle(node);
    if (['fixed', 'sticky'].includes(cs.position)) return true;
    // 面积较大且包含按钮也认可
    const rect = node.getBoundingClientRect();
    const btnCount = node.querySelectorAll('button,[role="button"],a[href],input[type="button"],input[type="submit"]').length;
    return (rect.height > 80 || rect.width > 300) && btnCount >= 2;
}

function findCookieBanner(root = document) {
    const candidates = [...root.querySelectorAll('div,section,aside,form,[role="dialog"]')].slice(0, 300);
    for (const el of candidates) {
        if (looksLikeCookieBanner(el)) return el;
    }
    return null;
}

function findRejectButton(banner) {
    const clickables = banner.querySelectorAll('button,[role="button"],a[href],input[type="button"],input[type="submit"]');
    for (const el of clickables) {
        if (!isVisible(el)) continue;
        const txt = normText(el);
        if (REJECT_RE_LIST.some(re => re.test(txt))) return el;
    }
    return null;
}

export async function tryHeuristics() {
    // ① 必须先找到 cookie 容器
    const banner = findCookieBanner(document);
    console.log('[CS] banner candidate =>', banner);
    if (!banner) return false;

    // ② 只在容器内找“拒绝/仅必要”
    const btn = findRejectButton(banner);
    console.log('[CS] reject button =>', btn, btn && normText(btn));
    if (!btn) return false;

    // ③ 点击前再兜一次险
    const txt = normText(btn);
    if (!REJECT_RE_LIST.some(re => re.test(txt))) return false;

    btn.click();
    return true;
}


