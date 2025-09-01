/**
 * @author xinggenguo
 * @date 2025/8/31
 * @description
 */

const KEY='guard_settings';
function linesToArr(v){return v.split('\n').map(s=>s.trim()).filter(Boolean);} 
function arrToLines(a){return (a||[]).join('\n');}
async function getSettings(){const{[KEY]:s}=await chrome.storage.sync.get(KEY);return s||{allowList:[],patterns:[],pauseMap:{},block3p:true,enabled:true};}
async function load(){const s=await getSettings();allowList.value=arrToLines(s.allowList);patterns.value=arrToLines(s.patterns);}
async function save(){const s=await getSettings();s.allowList=linesToArr(allowList.value);s.patterns=linesToArr(patterns.value);await chrome.storage.sync.set({[KEY]:s});msg.textContent='Saved.';setTimeout(()=>msg.textContent='',1200);}
async function exportSettings(){const s=await getSettings();const blob=new Blob([JSON.stringify(s,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='cookie-guard-settings.json';a.click();URL.revokeObjectURL(url);}
function importSettings(file){const fr=new FileReader();fr.onload=async()=>{try{const s=JSON.parse(fr.result);await chrome.storage.sync.set({[KEY]:s});msg.textContent='Imported. You may need to reload active tabs.';setTimeout(()=>msg.textContent='',1500);chrome.runtime.sendMessage({type:'RELOAD_DNR'});load();}catch(e){msg.textContent='Invalid file.';}};fr.readAsText(file);}
document.addEventListener('DOMContentLoaded',()=>{load();document.getElementById('save').addEventListener('click',save);document.getElementById('export').addEventListener('click',exportSettings);document.getElementById('import').addEventListener('click',()=>importFile.click());document.getElementById('importFile').addEventListener('change',e=>{const f=e.target.files[0];if(f) importSettings(f);});});
