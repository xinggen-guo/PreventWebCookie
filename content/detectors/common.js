/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

export function matchByText(regexList, root = document) {
  const nodes = [...root.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a')];
  return nodes.find(el => {
    const txt = (el.textContent || el.value || el.ariaLabel || '').trim();
    return regexList.some(rx => rx.test(txt));
  });
}

export function scoreButton(el, rxList) {
  const text = (el.textContent || el.value || el.ariaLabel || '').trim();
  let s = 0;
  if (rxList.some(rx => rx.test(text))) s += 5;
  if (el.matches('button,[role="button"]')) s += 2;
  if (el.closest('[aria-modal="true"], [role="dialog"], .modal, .cmp, .cookie')) s += 1;
  return s;
}

export function pickBestButton(rxList) {
  const candidates = [...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"],a')];
  return candidates.map(el => ({ el, s: scoreButton(el, rxList) })).sort((a,b)=>b.s-a.s)[0]?.el;
}

export async function safeClick(el) {
  if (!el) return false;
  el.focus();
  el.click();
  await new Promise(r => setTimeout(r, 400));
  const stillModal = !!document.querySelector('[aria-modal="true"], [role="dialog"], .ot-sdk-container, #onetrust-banner-sdk');
  return !stillModal;
}
