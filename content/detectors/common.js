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
const EXCLUDE_CONTAINER_RE = /(header|nav|menu|drawer|hamburger|^root$)/i;


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
    logger.log('[CS] isBottomOverlay  mode.className:', node.className, node.type);
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
    const percentLarge = (rect.width >= vw * 0.80) || (rect.height >= vh * 0.60);

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

    logger.debug('[check]', node.tagName,
        node.id ? `#${node.id}` : '',
        node.className ? `.${node.className}` : ''
    );

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
    }
    return manageCandidate;
}

// OneTrust: 精确获取弹窗根节点和遮罩
export function getOneTrustNodes(doc = document) {
    const root = doc.querySelector('#onetrust-banner-sdk, .ot-sdk-container');
    const dialog = root?.querySelector('[role="dialog"]') || root;
    const overlay = doc.querySelector('#onetrust-pc-dark-filter, .ot-hide, .ot-fade-in');
    return { root: dialog || root || null, overlay: overlay || null };
}

// 兜底：从任意一个“Cookie…”相关元素反推到弹窗容器
export function getBannerRootFromAny(el) {
    if (!el) return null;
    // 先就近往上找 onetrust 容器
    let c = el.closest('#onetrust-banner-sdk, .ot-sdk-container, [role="dialog"][aria-label*="cookie" i]');
    if (c) return c;
    // 找不到就全局搜一遍
    const { root } = getOneTrustNodes(document);
    if (root) return root;
    // 最后再用更泛化的容器
    c = el.closest('[role="dialog"], [aria-modal="true"]');
    return c || null;
}

export function hideNode(node) {
    if (!node || node.__cookieGuardHidden) return;
    node.__cookieGuardHidden = true;
    node.style.setProperty('display', 'none', 'important');
    node.style.setProperty('visibility', 'hidden', 'important');
    node.style.setProperty('opacity', '0', 'important');
    node.style.setProperty('pointer-events', 'none', 'important');
}

function markHidden(el) {
    if (!el) return;
    el.style.outline = "3px solid red";   // 红色描边
    el.style.backgroundColor = "rgba(255,0,0,0.05)"; // 微弱红色背景
    console.debug("[PreventWebCookie] would hide:", el);
}

// 解除常见滚动锁
export function unlockScroll() {
    document.documentElement?.style.setProperty('overflow', 'auto', 'important');
    document.body?.style.setProperty('overflow', 'auto', 'important');
}


function hasCmpWords(el) {
    const idc = `${el.id || ''} ${el.className || ''}`;
    const txt = (el.innerText || '').slice(0, 2000);
    return /(cookie|consent|privacy|gdpr|onetrust|didomi|policy)/i.test(idc + ' ' + txt);
}

function looksOverlayish(el) {
    const s = getComputedStyle(el);
    if (!(s.position === 'fixed' || s.position === 'sticky' || s.position === 'absolute')) return false;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const bottomAnchored = Math.abs(vh - r.bottom) <= 8;
    const topAnchored = Math.abs(r.top) <= 8;
    const tallEnough = r.height >= 40;
    return bottomAnchored || topAnchored || tallEnough;
}

// 计算面积
function _area(el){ const r=el.getBoundingClientRect(); return Math.max(1, r.width*r.height); }

// 在 banner 内找“最大且像弹窗/覆盖条/含 cookie 语义”的块作为隐藏目标
export function resolveContainerForHide(btn, banner){
    // 先尝试你已有的近亲容器（不越过 banner）
    let cur = btn || banner;
    for(let i=0;i<6 && cur;i++){
        if (cur.matches?.('[role="dialog"],[aria-modal="true"]')) { if(banner.contains(cur)) return cur; break; }
        if (hasCmpWords(cur) || looksOverlayish(cur)) { if(banner.contains(cur)) return cur; }
        if (cur.parentElement === banner) break;
        cur = cur.parentElement;
    }
    // 兜底：在 banner 内部挑“最像弹窗/覆盖条”的最大块
    const cand = Array.from(banner.querySelectorAll('*')).filter(e=>{
        if(!(e instanceof Element)) return false;
        if(!isVisible(e)) return false;
        return looksOverlayish(e) || hasCmpWords(e);
    });
    if(cand.length){
        cand.sort((a,b)=>_area(b)-_area(a));
        const best = cand[0];
        if (banner.contains(best)) return best;
    }
    return banner; // 还不行就隐藏整个 banner 根（不会越界到 #root）
}

// 取数值 z-index
function _z(el){ const z=getComputedStyle(el).zIndex; const n=+z; return Number.isFinite(n)?n:0; }

// 大小是否接近全屏
function _coversViewport(el){
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth || document.documentElement.clientWidth || 0;
    const vh = window.innerHeight || document.documentElement.clientHeight || 0;
    const cover = (r.width>=vw*0.9 && r.height>=vh*0.9);
    const bg = getComputedStyle(el).backgroundColor || '';
    const alpha = /^rgba?\(.+?(\d*\.?\d+)\)$/.test(bg) ? parseFloat(RegExp.$1) : 1;
    return cover && alpha>0 && getComputedStyle(el).position==='fixed';
}

// 隐藏与目标同层或更上层的全屏遮罩（不包含目标本身）
export function hideBackdropAround(target){
    if(!target) return;
    const tz = _z(target);
    const all = document.querySelectorAll('div,section,aside,dialog,[role="dialog"]');
    for(const el of all){
        if(el===target || target.contains(el) || el.contains(target)) continue;
        if(!isVisible(el)) continue;
        if(_coversViewport(el) && _z(el) >= tz) {
            hideNode(el);
        }
    }
}

export async function tryHeuristics() {
    // 必须先找到 cookie 容器
    const banner = findCookieBanner(document);
    logger.log('[CS] banner candidate =>', banner);
    if (!banner) return false;

    // 只在容器内找“拒绝/仅必要”
    const btn = findRejectButton(banner);
    logger.log('[CS] reject button =>', btn, btn && normText(btn));
    if (!btn) return false;

    const target = btn.closest('[role="dialog"], [aria-modal="true"], .cookie-banner, .consent, .privacy')
        || banner
        || btn.parentElement
        || btn;
    // markHidden(target)
    hideNode(target);

    // 解除滚动锁
    unlockScroll();

    // 只有在确认消失后，才当作 handled
    const gone = !isVisible(target);
    logger.log('[CS] hidden OneTrust =>', {gone});
    return true;
}