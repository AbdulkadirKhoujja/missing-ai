import {HISTORY_LIMITS,importChatGPTExport,addLocalNote,reviewContext} from "./history-context.mjs";
import {encryptHistory,decryptHistory} from "./history-vault.mjs";
const el=id=>document.getElementById(id);
let messages=[];
const state=el("import-status"),vaultStatus=el("vault-status"),results=el("history-results");
const sharedPagesOrigin=location.hostname==="abdulkadirkhoujja.github.io";
if(sharedPagesOrigin){
 for(const id of ["vault-passphrase","save-vault","load-vault","delete-vault"])el(id).disabled=true;
 vaultStatus.textContent="Encrypted browser storage is intentionally disabled on this shared GitHub Pages origin. Use a private, isolated self-hosted origin for saved histories. You can still review history in this session.";
}
function updateCount(extra=""){state.textContent=messages.length.toLocaleString()+" history messages in this session."+(extra?" "+extra:"");}
function reportError(target,error){target.textContent=error instanceof Error?error.message:String(error);}
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;}
function showReport(report){
 results.replaceChildren();
 results.append(node("h3",report.summary.potential_overlooks+" possible overlook(s); "+report.summary.related+" related excerpt(s)"));
 results.append(node("p",report.limitations,"history-result-note"));
 if(!report.findings.length){results.append(node("p","No matching earlier messages were found in this imported selection. This does not establish that relevant history does not exist."));return;}
 for(const f of report.findings){
  const item=node("article",undefined,"history-finding");
  const label=f.kind==="possible_access_recheck"?"Possible repeated access request":f.kind==="possible_repeated_work"?"Possible repeated work":"Related earlier message";
  item.append(node("h3",label),node("small",f.conversation+" · "+(f.role==="note"?"manual note":f.role)+" · "+(f.date?new Date(f.date).toLocaleDateString():"date unavailable")));
  item.append(node("blockquote",f.quote));
  item.append(node("small","Matched terms: "+(f.matched_terms.join(", ")||"none")+". Earlier statement; verify against current evidence."));
  results.append(item);
 }
}
el("history-file").addEventListener("change",async event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(file.size>HISTORY_LIMITS.maxFileBytes){state.textContent="File exceeds 25 MB. Split/export a smaller JSON selection. No file was loaded.";return;}
 if(!file.name.toLowerCase().endsWith(".json")){state.textContent="Select conversations.json (not the export ZIP).";return;}
 state.textContent="Reading selected local file…";
 try{
  const data=JSON.parse(await file.text()),imported=importChatGPTExport(data);
  if(!imported.messages.length)throw Error("No supported active-branch text messages were found.");
  messages=imported.messages;
  updateCount("Parsed "+imported.stats.conversations+" conversations; "+imported.stats.skipped_branches+" skipped because the active branch was unavailable. Each message is capped at 3,000 characters.");
 }catch(error){reportError(state,error);}finally{event.target.value="";}
});
el("add-note").addEventListener("click",()=>{
 try{messages=addLocalNote(messages,el("note-title-input").value,el("note-text").value);updateCount("Manual note added; it is not independently verified.");el("note-text").value="";el("note-title-input").value="";}catch(error){reportError(state,error);}
});
el("review-answer").addEventListener("click",()=>{
 try{showReport(reviewContext(messages,el("answer-text").value));}catch(error){results.replaceChildren(node("p",error.message,"history-status"));}
});
el("clear-session").addEventListener("click",()=>{messages=[];results.replaceChildren(node("p","Session cleared.","history-status"));el("answer-text").value="";updateCount("This does not delete an encrypted saved copy.");});
const DB="missing-ai-history-local-v1",STORE="encrypted-history",RECORD="user-vault";
function openDb(){return new Promise((resolve,reject)=>{
 if(!("indexedDB" in window)){reject(Error("IndexedDB unavailable in this browser."));return;}
 const req=indexedDB.open(DB,1);
 req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
 req.onerror=()=>reject(req.error||Error("Cannot open local browser storage."));
 req.onsuccess=()=>resolve(req.result);
});}
async function dbOperation(mode,method,value){const db=await openDb();try{return await new Promise((resolve,reject)=>{
 const tx=db.transaction(STORE,mode),request=tx.objectStore(STORE)[method](...(method==="put"?[value,RECORD]:[RECORD]));
 let result;request.onsuccess=()=>{result=request.result;};request.onerror=()=>reject(request.error||Error("Local storage request failed."));
 tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||Error("Local storage transaction failed."));tx.onabort=()=>reject(tx.error||Error("Local storage transaction aborted."));
});}finally{db.close();}}
function passphrase(){return el("vault-passphrase").value;}
function forgetPassphrase(){el("vault-passphrase").value="";}
el("save-vault").addEventListener("click",async()=>{
 try{if(!messages.length)throw Error("Import a history or add a note first.");vaultStatus.textContent="Encrypting locally…";const record=await encryptHistory(messages,passphrase());await dbOperation("readwrite","put",record);vaultStatus.textContent="Encrypted copy saved in this browser. Unlock with your passphrase after reopening this page.";}
 catch(error){reportError(vaultStatus,error);}finally{forgetPassphrase();}
});
el("load-vault").addEventListener("click",async()=>{
 try{const record=await dbOperation("readonly","get");if(!record)throw Error("No saved encrypted copy found in this browser.");vaultStatus.textContent="Unlocking locally…";const restored=await decryptHistory(record,passphrase());messages=restored;updateCount("Unlocked encrypted copy.");vaultStatus.textContent="Copy unlocked for this browser session.";}
 catch(error){reportError(vaultStatus,error);}finally{forgetPassphrase();}
});
el("delete-vault").addEventListener("click",async()=>{
 try{await dbOperation("readwrite","delete");vaultStatus.textContent="Saved encrypted copy deleted from this browser. Session memory is unchanged.";}catch(error){reportError(vaultStatus,error);}finally{forgetPassphrase();}
});
