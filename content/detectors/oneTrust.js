/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

export const OneTrustAdapter = {
  name: "OneTrust",
  detect(doc) {
    return !!doc.querySelector('#onetrust-banner-sdk, .ot-sdk-container');
  },
  async reject(doc) {
    const btn = doc.querySelector('#onetrust-reject-all-handler, .ot-pc-refuse-all-handler');
    if (btn) { btn.click(); return true; }
    return false;
  }
};
