/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

const {logger} = await import(chrome.runtime.getURL('util/Logger.js'));

// Banner keywords (broadened)
const BANNER_RE = /(cookie|consent|privacy|gdpr|同意|隐私|拒绝|仅.*必要|allow all|cookie preferences|manage preferences|preferences|cookie settings)/i;

// 关键词：按钮必须出现这些“拒绝/仅必要”词之一（也参与语义 double-check）
const REJECT_RE_LIST = [
    /reject all/i,
    /reject additional cookies/i,
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


const NO_THANKS_FALLBACK =[
    /reject all/i,
    /reject additional cookies/i,
    /reject (non[- ]?essential|optional) cookies/i,
    /\breject(?:\s+everything)?\b/i,
    /\bdecline(?:\s+all)?\b/i,
    /\bdeny(?:\s+all)?\b/i,
    /\bdisagree\b/i,
    /only (essential|necessary|strictly necessary) cookies?/i,
    /(strictly\s+)?necessary\s+only/i,
    /\bno[, ]?(thank( you)?|thanks?)\b/i,  // No thank you / No thanks
    /\brefuse\b/i,
    /仅.*必要/i, /只.*必要/i, /严格必要/i,
    /拒绝.*全部/i, /不接受.*全部/i, /不同意/i,
]
// 明确排除：典型导航/抽屉/汉堡菜单相关
const EXCLUDE_CONTAINER_RE = /(header|nav|menu|drawer|hamburger|^root$)/i;

const CLICKABLE_QS =
    'button,[role="button"],input[type="button"],input[type="submit"],[tabindex]';

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
    const anchor = getFixedAnchor(node) || node;          // 优先用 fixed 祖先
    if (!(anchor instanceof Element)) return false;
    const rect = anchor.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    // 贴近底部（<= 48px）或进入下半屏 45% 区域
    const nearBottom = (vh - rect.bottom) <= 48 || rect.top >= vh * 0.55;

    // 宽度 ≥ 60% 视口（但不超过 720 的硬下限）
    const wideEnough = rect.width >= Math.min(vw * 0.60, 720);

    // 高度 ≥ 60px
    const tallEnough = rect.height >= 60;
    return nearBottom && wideEnough && tallEnough;
}

// 中间模态（center modal/dialog）
function isCenterModal(node) {
    if (!(node instanceof Element)) return false;
    const cs = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

    const isDialogAttr = node.matches?.('[role="dialog"],[aria-modal="true"]');
    const isOverlayPos = ['fixed', 'sticky'].includes(cs.position);
    const centered = Math.abs((rect.left + rect.right) / 2 - vw / 2) < vw * 0.2
        && Math.abs((rect.top + rect.bottom) / 2 - vh / 2) < vh * 0.25;
    const bigEnough = rect.width >= Math.min(vw * 0.35, 420) || rect.height >= 160;

    // 典型：role/aria + fixed；或者视口中间的大块区域
    return !!((isDialogAttr && isOverlayPos) || (isOverlayPos && centered && bigEnough));
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

function looksLikeCookieBanner(node) {
    if (!node || !isVisible(node)) return false;

    // 排除明显的导航类容器
    if (EXCLUDE_CONTAINER_RE.test(node.className || '') ||
        EXCLUDE_CONTAINER_RE.test(node.id || '')) return false;

    const cs = getComputedStyle(node);

    const rect = node.getBoundingClientRect();
    // 视口尺寸 & 百分比阈值
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const percentLarge = (rect.width >= vw * 0.80) || (rect.height >= vh * 0.30);

    // 按钮数量与大块阈值（像素兜底）
    const btnCount = node.querySelectorAll(
        'button,[role="button"],a[href],input[type="button"],input[type="submit"]'
    ).length;
    const hasButtons = btnCount >= 2;
    const bigBlock = rect.height > 80 || rect.width > 300;

    // 类名提示：常见消息容器/底部条
    const classHint = /\bmessage-container\b|\bmessage(?:\s|-)type-bottom\b/i
        .test(node.className || '');

    // 形态候选：底部悬浮 / 中间弹窗 / 特定类名 / 大面积覆盖 / 固定定位的大块+按钮
    const shapeCandidate =
        isBottomOverlay(node) ||
        isCenterModal(node) ||
        ((classHint || percentLarge) &&
            (['fixed', 'sticky'].includes(cs.position) || bigBlock) &&
            hasButtons);

    if (!shapeCandidate) return false;

    // 语义确认：必须“像 cookie/同意 设置”
    return isCookieSemantics(node);
}

function findCookieBanner(root = document) {
    const candidates = [...root.querySelectorAll('div,section,aside,form,[role="dialog"]')].slice(0, 300);
    for (const el of candidates) {
        if (looksLikeCookieBanner(el)) return el;
    }
    return null;
}

function ignoreNode(el) {
    if (!el || !el.tagName) return true;   // 防御空节点
    const tag = el.tagName.toLowerCase();
    // 1. 过滤掉无意义的容器标签
    if (tag === 'a' || tag === 'ul' || tag === 'p') return true;
    const label = labelOf(el);
    // 2. 完全没有可读文字 / aria 的标签 (只包含 svg/img/a 的 Logo)
    if (!label && el.querySelector('svg, img, a')) return true;
    return false;
}

// 深度遍历（含 shadow DOM）
function* walkDeep(root, max = 300) {
    const stack = [root];
    let seen = 0;
    while (stack.length && seen < max) {
        const n = stack.pop();
        if (!(n instanceof Element)) continue;
        yield n;
        seen++;

        // 子元素
        for (let i = n.children.length - 1; i >= 0; i--) {
            if (ignoreNode(n.children[i])) continue;
            stack.push(n.children[i]);
        }
        // Shadow root
        if (n.shadowRoot) {
            for (let i = n.shadowRoot.children.length - 1; i >= 0; i--) {
                if (ignoreNode(n.shadowRoot.children[i])) continue;
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
    let bestBtn = null;
    let bestScore = 0; // 0 none, 1 manage, 2 weak, 3 strong
    const seen = new Set(); // 去重：同一按钮只看一次

    let n = 0
    for (const node of walkDeep(banner)) {
        if (!(node instanceof Element)) continue;
        logger.log('[CS] handAndActReject =>n ',n);
        n++
        // 1) 归一化：找到最近的“可点击祖先”
        const btn = isClickable(node) ? node : node.closest?.(CLICKABLE_QS);
        if (!btn) continue;

        // 2) 去重（同一个按钮的不同子节点会反复命中）
        if (seen.has(btn)) continue;
        seen.add(btn);

        // 3) 必须可见再考虑
        if (!isVisible(btn)) continue;

        // 4) 取文案并规范化空白
        const raw = labelOf(btn) || '';
        const label = raw.replace(/\s+/g, ' ').trim();
        if (!label) continue;

        // 5) 打分（根据你的实现选择其一）
        // const score = classify(btn);
        const score = classify(label);

        logger.log('[CS] handAndActReject =>', btn.tagName, btn.id, label);
        logger.log('[CS] handAndActReject => score ', score);

        if (score === 0) continue;

        // 6) 强匹配 => 立即返回
        if (score === 3) {
            return btn;
        }

        // 7) 记录当前最优
        if (score > bestScore) {
            bestScore = score;
            bestBtn = btn;
        }

        // 8) 记录“管理/设置/偏好”候选（用于二跳流程）
        if (!manageCandidate && /\b(manage|settings?|preferences?)\b/i.test(label)) {
            manageCandidate = btn;
        }
    }

    // 9) 兜底返回
    return bestBtn || manageCandidate || null;
}

export function hideNode(node) {
    if (!node || node.__cookieGuardHidden) return;
    node.__cookieGuardHidden = true;
    logger.log('[CS] hideNode =>', node);
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('opacity', '0', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
}

// 解除常见滚动锁
export function unlockScroll() {
    document.documentElement?.style.setProperty('overflow', 'auto', 'important');
    document.body?.style.setProperty('overflow', 'auto', 'important');
}

export function clickElements(btn){
    btn.click()
    logger.log('[CS] clickElements =>', btn);
}

function classify(label) {
    if (NO_THANKS_FALLBACK.some((re => re.test(label)))) return 3;
    if (REJECT_RE_LIST.some(re => re.test(label))) return 2;
    if (BANNER_RE.test(label)) return 1;
    return 0;
}

export async function tryHeuristics() {
    // 必须先找到 cookie 容器
    const banner = findCookieBanner(document);
    if (!banner) return false;
    logger.log('[CS] banner candidate =>', banner);
    // 只在容器内找“拒绝/仅必要”
    let rejectBtn = findRejectButton(banner);
    if (rejectBtn) {
        logger.log('[CS] banner candidate => btn =>', rejectBtn);
        clickElements(rejectBtn)
    } else {
        //i need more confirm this is cookie dialog then i can hide it, or to click is prefect
        // const target = btn.closest('[role="dialog"], [aria-modal="true"], .cookie-banner, .consent, .privacy')
        //     || banner
        //     || btn.parentElement
        //     || btn;
        // // markHidden(target)
        // hideNode(target);
        //
        // // 解除滚动锁
        // unlockScroll();
        //
        // // 只有在确认消失后，才当作 handled
        // const gone = !isVisible(target);
        // logger.log('[CS] hidden OneTrust =>', {gone});
    }

    return true;
}