/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

export const DidomiAdapter = {
  name: "Didomi",
  detect(doc) {
    return !!doc.querySelector('[id^="didomi-host"] .didomi-popup-container, .didomi-consent-popup');
  },
  async reject(doc) {
    const btn = doc.querySelector('button[id^="didomi-notice-disagree-button"], .didomi-components-button--secondary');
    if (btn) { btn.click(); return true; }
    return false;
  }
};
