/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

function qs(id){return document.getElementById(id);}
async function getActiveInfo(){const [tab]=await chrome.tabs.query({active:true,currentWindow:true});let host='';try{host=new URL(tab.url).hostname}catch{};return{tabId:tab?.id,host};}
document.addEventListener('DOMContentLoaded',async()=>{
  chrome.runtime.sendMessage({type:'GET_SUMMARY'},async(res)=>{
    const {settings,stats}=res||{};
    qs('stats').textContent=`Removed cookies: ${stats?.cookiesRemoved||0} | Banners handled: ${stats?.bannersHandled||0}`;
    qs('block3p').checked=!!settings?.block3p;
    const {tabId,host}=await getActiveInfo();
    qs('pauseSite').checked=!!settings?.pauseMap?.[host];
    qs('block3p').addEventListener('change',e=>chrome.runtime.sendMessage({type:'SET_BLOCK_3P',value:e.target.checked}));
    qs('pauseSite').addEventListener('change',e=>{chrome.runtime.sendMessage({type:'TOGGLE_PAUSE',host}); if(tabId) chrome.tabs.sendMessage(tabId,{type:'PAUSE_CONTENT'});});
  });
});
