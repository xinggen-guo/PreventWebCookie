/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */



export async function initDynamicRules() {
  const baseDynamic = [{
    id: 10001,
    priority: 1,
    action: { type: "block" },
    condition: { urlFilter: "||facebook.com/tr^", resourceTypes: ["image","xmlhttprequest"] }
  }];

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const toDel = existing.map(r => r.id);
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: toDel, addRules: baseDynamic });
}
