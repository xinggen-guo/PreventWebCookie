/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

const { logger }   = await import(chrome.runtime.getURL('util/Logger.js'));

// 关键词：容器要出现这些词之一（语义 double-check 的一部分）
const BANNER_RE = /(cookie|consent|privacy|gdpr|同意|隐私|拒绝|仅.*必要)/i;

// 关键词：按钮必须出现这些“拒绝/仅必要”词之一（也参与语义 double-check）
const REJECT_RE_LIST = [
    /reject all/i,
    /reject additional cookies/i,         // BBC
    /reject (non[- ]?essential|optional) cookies/i,
    /\breject(?:\s+everything)?\b/i,
    /\bdecline(?:\s+all)?\b/i,
    /\bdeny(?:\s+all)?\b/i,
    /\bdisagree\b/i,
    /only (essential|necessary|strictly necessary) cookies?/i,
    /(strictly\s+)?necessary\s+only/i,
    /save (my )?choices?/i,                // Let me choose 确认
    /\bno[, ]?(thank( you)?|thanks?)\b/i,  // No thank you / No thanks
    /\bnot (now|interested)\b/i,           // Not now / Not interested
    /\brefuse\b/i,
    /continue without( accepting)?/i,      // Continue without accepting
    /仅.*必要/i, /只.*必要/i, /严格必要/i,
    /拒绝.*全部/i, /不接受.*全部/i, /不同意/i,
    /管理.*cookie/i, /设置.*cookie/i        // 二跳确认兜底
];

// 明确排除：典型导航/抽屉/汉堡菜单相关
const EXCLUDE_CONTAINER_RE = /(header|nav|menu|drawer|hamburger)/i;

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

/* ---------------- 新增：形态识别（底部悬浮 & 中间弹窗）+ 语义 double-check ---------------- */

function getFixedAnchor(node) {
    // 向上最多找 5 层，命中 position: fixed/sticky 的祖先就返回
    let cur = node;
    for (let i = 0; i < 5 && cur && cur !== document.body; i++) {
        if (!(cur instanceof Element)) break;
        const cs = getComputedStyle(cur);
        if (cs.position === 'fixed' || cs.position === 'sticky') return cur;
        cur = cur.parentElement || cur.parentNode;
    }
    return null;
}

// 底部悬浮条（bottom overlay / bar）
function isBottomOverlay(node) {
    logger.log('[CS] isBottomOverlay mode.className:',node.className);
    const anchor = getFixedAnchor(node) || node;          // 优先用 fixed 祖先
    if (!(anchor instanceof Element)) return false;
    logger.log('[CS] isBottomOverlay 111111  mode.className:',node.className);
    const rect = anchor.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    // 贴近底部（<= 48px）或进入下半屏 45% 区域
    const nearBottom = (vh - rect.bottom) <= 48 || rect.top >= vh * 0.55;

    // 宽度 ≥ 60% 视口（但不超过 720 的硬下限）
    const wideEnough = rect.width >= Math.min(vw * 0.60, 720);

    // 高度 ≥ 60px
    const tallEnough = rect.height >= 60;
    const result = nearBottom && wideEnough && tallEnough;
    logger.log('[CS] isBottomOverlay candidate =>', result);
    // 再做一次语义确认（防误杀）
    return nearBottom && wideEnough && tallEnough;
}

// 中间模态（center modal/dialog）
function isCenterModal(node) {
    if (!(node instanceof Element)) return false;
    const cs = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const isDialogAttr = node.matches?.('[role="dialog"],[aria-modal="true"]');
    const isOverlayPos = ['fixed', 'sticky'].includes(cs.position);
    const centered     = Math.abs((rect.left + rect.right)/2 - vw/2) < vw * 0.2
        && Math.abs((rect.top  + rect.bottom)/2 - vh/2) < vh * 0.25;
    const bigEnough    = rect.width >= Math.min(vw * 0.35, 420) || rect.height >= 160;

    // 典型：role/aria + fixed；或者视口中间的大块区域
    return !!( (isDialogAttr && isOverlayPos) || (isOverlayPos && centered && bigEnough) );
}

// 语义 double-check：容器本身文本或其按钮文本需符合“cookie/同意/仅必要/拒绝”等
function isCookieSemantics(node) {
    if (BANNER_RE.test(normText(node))) return true;
    const clickables = node.querySelectorAll('button,[role="button"],a[href],input[type="button"],input[type="submit"]');
    for (const el of clickables) {
        const txt = normText(el);
        if (!txt) continue;
        if (REJECT_RE_LIST.some(re => re.test(txt))) return true;
    }
    return false;
}

/* ---------------- 更新：looksLikeCookieBanner 使用“形态 + 语义”双重确认 ---------------- */

function looksLikeCookieBanner(node) {
    if (!node || !isVisible(node)) return false;

    // 排除明显的导航类容器
    if (EXCLUDE_CONTAINER_RE.test(node.className || '') ||
        EXCLUDE_CONTAINER_RE.test(node.id || '')) return false;

    const cs = getComputedStyle(node);

    const rect = node.getBoundingClientRect();
    // 视口尺寸 & 百分比阈值
    const vw = Math.max(document.documentElement.clientWidth,  window.innerWidth  || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const percentLarge = (rect.width >= vw * 0.80) || (rect.height >= vh * 0.60);

    // 按钮数量与大块阈值（像素兜底）
    const btnCount  = node.querySelectorAll(
        'button,[role="button"],a[href],input[type="button"],input[type="submit"]'
    ).length;
    const hasButtons = btnCount >= 2;
    const bigBlock   = rect.height > 80 || rect.width > 300;

    // 类名提示：常见消息容器/底部条
    const classHint = /\bmessage-container\b|\bmessage(?:\s|-)type-bottom\b/i
        .test(node.className || '');

    // 形态候选：底部悬浮 / 中间弹窗 / 特定类名 / 大面积覆盖 / 固定定位的大块+按钮

    logger.debug('[check]', node.tagName,
        node.id ? `#${node.id}` : '',
        node.className ? `.${node.className}` : ''
    );

    const shapeCandidate =
        isBottomOverlay(node) ||
        isCenterModal(node)   ||
        classHint             ||
        percentLarge          ||
        (['fixed', 'sticky'].includes(cs.position) && (bigBlock || percentLarge) && hasButtons);

    if (!shapeCandidate) return false;

    // 语义确认：必须“像 cookie/同意 设置”
    return isCookieSemantics(node);
}

/* ---------------- 其余逻辑保持不变 ---------------- */

function findCookieBanner(root = document) {
    const candidates = [...root.querySelectorAll('div,section,aside,form,[role="dialog"]')].slice(0, 300);
    for (const el of candidates) {
        if (looksLikeCookieBanner(el)) return el;
    }
    return null;
}

// 深度遍历（含 shadow DOM）
function* walkDeep(root, max = 8000) {
    const stack = [root];
    let seen = 0;
    while (stack.length && seen < max) {
        const n = stack.pop();
        if (!(n instanceof Element)) continue;
        yield n;
        seen++;

        // 子元素
        for (let i = n.children.length - 1; i >= 0; i--) stack.push(n.children[i]);
        // Shadow root
        if (n.shadowRoot) {
            for (let i = n.shadowRoot.children.length - 1; i >= 0; i--) {
                stack.push(n.shadowRoot.children[i]);
            }
        }
    }
}

// 是否可点击（包含多种变体）
function isClickable(el) {
    if (!(el instanceof Element)) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'button') return true;
    if (tag === 'a' && el.hasAttribute('href')) return true;
    if (tag === 'input') {
        const t = (el.getAttribute('type') || '').toLowerCase();
        if (t === 'button' || t === 'submit') return true;
    }
    if (el.getAttribute('role') === 'button') return true;
    if (el.tabIndex >= 0) return true;
    return false;
}

// 聚合元素的可读标签（文本 + aria-label + title）
function labelOf(el) {
    if (!el) return '';
    const t1 = el.textContent || '';
    const t2 = el.getAttribute?.('aria-label') || '';
    const t3 = el.getAttribute?.('title') || '';
    return (t1 + ' ' + t2 + ' ' + t3).replace(/\s+/g, ' ').trim();
}

function findRejectButton(banner) {
    let manageCandidate = null;
    for (const node of walkDeep(banner)) {
        if (!isVisible(node)) continue;

        // 找到“最近的可点击祖先”
        let btn = node;
        if (!isClickable(btn)) {
            btn = node.closest?.('button,[role="button"],a[href],input[type="button"],input[type="submit"],[tabindex]');
            if (!btn) continue;
        }
        if (!isVisible(btn)) continue;

        // 原 label
        const rawLabel = labelOf(btn);

        // 通用化处理：把所有空白字符都转为单一空格，再 trim
        const label = rawLabel.replace(/\s+/g, ' ').trim();


        const NO_THANKS_FALLBACK = /\bno\s*[-,]?\s*thank(?:s)?\b/i;

        if (REJECT_RE_LIST.some(re => re.test(label)) || NO_THANKS_FALLBACK.test(label)) {
            return btn;
        }

        // 2) 记录一个“管理类”的候选，用于二跳流程
        if (!manageCandidate && /\b(manage|settings?|preferences?)\b/i.test(label)) {
            manageCandidate = btn;
        }
        // ====== 修改到这里结束 ======

    }
    return manageCandidate || null;
}

export async function tryHeuristics() {
    // ① 必须先找到 cookie 容器
    const banner = findCookieBanner(document);
    logger.log('[CS] banner candidate =>', banner);
    if (!banner) return false;

    // ② 只在容器内找“拒绝/仅必要”
    const btn = findRejectButton(banner);
    logger.log('[CS] reject button =>', btn, btn && normText(btn));
    if (!btn) return false;

    btn.click();
    return true;
}