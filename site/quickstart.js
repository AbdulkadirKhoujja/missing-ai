import {makeContextEntries,parseContextPack,mergeContextEntries,serializeContextPack,CONTEXT_LIMITS} from './context-onboarding.mjs';
import {reviewContext} from './history-context.mjs';

const el=id=>document.getElementById(id);
const status=el('context-status');
const review=el('results');
let approved=[];
let pending=null;
let pendingFingerprint='';
const marker=()=>el('source-title').value+'\u0000'+el('source-text').value;
function node(tag,value){const e=document.createElement(tag);if(value!==undefined)e.textContent=value;return e;}
function setStatus(text){status.textContent=text;}
function clearPreview(){pending=null;pendingFingerprint='';el('context-preview').replaceChildren(node('p','Preview the text before confirming.'));}
for(const id of ['source-title','source-text']) el(id).addEventListener('input',()=>{clearPreview();el('approved-check').checked=false;});
el('preview-context').addEventListener('click',()=>{
  try {
    pending=makeContextEntries(el('source-title').value,el('source-text').value);
    pendingFingerprint=marker();
    el('approved-check').checked=false;
    const target=el('context-preview');target.replaceChildren();
    target.append(node('h3',`Review ${pending.length} note${pending.length===1?'':'s'} before adding`));
    for(const entry of pending){const section=node('article');section.append(node('strong',entry.conversation),node('p',entry.text));target.append(section);}
    setStatus('Preview ready. Confirm the reviewed content below to add it to this session.');
  } catch(error){clearPreview();setStatus(error.message);}
});
el('add-context').addEventListener('click',()=>{
  try {
    if(!pending||pendingFingerprint!==marker())throw Error('Preview your current summary first.');
    if(!el('approved-check').checked)throw Error('Confirm that you reviewed and are authorised to use this content.');
    const merged=mergeContextEntries(approved,pending);approved=merged.entries;
    el('approved-check').checked=false;clearPreview();
    setStatus(`${merged.added} reviewed note(s) added. ${approved.length} available in this browser session. No upload occurred.`);
    updateControls();
  } catch(error){setStatus(error.message);}
});
function updateControls(){el('download-pack').disabled=approved.length===0;el('review-answer').disabled=approved.length===0;el('clear-context').disabled=approved.length===0;}
el('pack-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try {
    if(file.size>CONTEXT_LIMITS.packBytes)throw Error('Context pack exceeds 2 MB.');
    const loaded=parseContextPack(await file.text());const merged=mergeContextEntries(approved,loaded);
    approved=merged.entries;updateControls();
    setStatus(`${merged.added} note(s) restored from the selected local file. ${approved.length} available; duplicates skipped.`);
  }catch(error){setStatus(error.message);}finally{event.target.value='';}
});
el('download-pack').addEventListener('click',()=>{
  try{
    if(!approved.length)throw Error('Add reviewed notes first.');
    if(!window.confirm('Download these reviewed notes as an unencrypted plain-text file? Keep it private.'))return;
    const blob=new Blob([serializeContextPack(approved)],{type:'application/x-ndjson;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='missing-ai-context-pack.jsonl';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setStatus('Downloaded the reviewed notes as a local JSONL file. This page did not upload them.');
  }catch(error){setStatus(error.message);}
});
el('clear-context').addEventListener('click',()=>{
  if(!window.confirm('Clear all reviewed notes from this browser session?'))return;
  approved=[];pending=null;pendingFingerprint='';el('source-title').value='';el('source-text').value='';el('answer-text').value='';
  clearPreview();review.replaceChildren(node('p','No review performed.'));updateControls();setStatus('Session cleared. Downloaded files are unaffected.');
});
el('review-answer').addEventListener('click',()=>{
  try {
    const report=reviewContext(approved.map((r,i)=>({id:`approved:${i}`, ...r})),el('answer-text').value);
    review.replaceChildren(node('h3',`${report.summary.potential_overlooks} possible overlook(s); ${report.summary.related} related excerpt(s)`),node('p',report.limitations));
    if(!report.findings.length){review.append(node('p','No matching note found in this selection; that does not prove relevant history is absent.'));return;}
    for(const f of report.findings){
      const card=node('article');card.className='result-card';
      const label=f.kind==='possible_access_recheck'?'Possible repeated access request':f.kind==='possible_repeated_work'?'Possible repeated work':'Related earlier note';
      card.append(node('h3',label),node('small',`${f.conversation} · user-reviewed summary, not independent proof`),node('blockquote',f.quote));review.append(card);
    }
  } catch(error){review.replaceChildren(node('p',error.message));}
});
updateControls();
