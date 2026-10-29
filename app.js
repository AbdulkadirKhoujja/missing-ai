import {checkMissing} from "./shared/checker.mjs";
const el=id=>document.getElementById(id);
const source=el("source-text"), output=el("output-text"), results=el("results");
let latest=null;
[source,output].forEach((element)=>element.addEventListener("input",()=>{
 el("source-length").textContent=source.value.length.toLocaleString()+" characters";
 el("output-length").textContent=output.value.length.toLocaleString()+" characters";
}));
function node(tag,text,className){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e}
function warning(message){results.replaceChildren();const wrap=node("div",undefined,"results-view");wrap.append(node("div","CHECK NOT COMPLETED","mini-title"),node("h3",message),node("p","Try pasting a shorter, complete set of requirements and the AI output.","result-note"));results.append(wrap);}
function textReport(report){
 const lines=["Missing AI — lexical report", "", "Matches are based on overlapping terms, not semantic proof. A flagged item may actually be satisfied.", "", `Needs review: ${report.summary.needs_review}; likely mentioned: ${report.summary.likely_mentioned}; text found: ${report.summary.text_found}`, ""];
 for(const finding of report.findings){
  lines.push(`${finding.id} · Source line ${finding.line ?? "unknown"} · ${finding.status}`,finding.text,"");
 }
 lines.push(report.limitations);
 return lines.join("\n");
}
function present(report){results.replaceChildren();const wrap=node("div",undefined,"results-view");
wrap.append(node("div","YOUR GAP REPORT","mini-title"),node("h3",report.summary.needs_review+" item(s) need a second look"),node("p","Matches are based on overlapping terms, not semantic proof. A flagged item may actually be satisfied.","result-note"));
const counts=node("div",undefined,"result-counts");for(const [key,label] of [["needs_review","Review"],["likely_mentioned","Mentioned"],["text_found","Exact"]]){const block=node("div",undefined,"count");block.append(node("strong",String(report.summary[key])),node("span",label));counts.append(block);}wrap.append(counts);
for(const f of report.findings){const item=node("article",undefined,"finding "+f.status);item.append(node("div",f.id+" · "+(f.line?"SOURCE LINE "+f.line+" · ":"") + (f.status==="needs_review"?"NEEDS REVIEW":f.status==="text_found"?"TEXT FOUND":"LIKELY MENTIONED"),"finding-kicker"),node("strong",f.text),node("small",f.status==="needs_review"?"Not clearly matched in the supplied output. Confirm manually.":f.status==="text_found"?"Exact wording located in supplied output.": "Related keywords found, but this does not establish completion."));wrap.append(item);}
if(!report.findings.length)wrap.append(node("p","No checklist-style requirements were extracted. Try a source with bullets or explicit instructions.","result-note"));
const caveat=node("p",report.limitations,"result-note");wrap.append(caveat);
const copy=node("button","Copy report as JSON","copy-btn");copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));copy.textContent="Copied ✓"}catch{copy.textContent="Copy failed — browser permission required"}});wrap.append(copy);
const textCopy=node("button","Copy report as text","copy-btn");textCopy.type="button";
const copyStatus=node("p","","result-note");copyStatus.setAttribute("role","status");
textCopy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(textReport(report));copyStatus.textContent="Text report copied."}catch{copyStatus.textContent="Could not copy text report. Check clipboard permission and try again."}});
wrap.append(textCopy,copyStatus);
results.append(wrap);
}
el("check-btn").addEventListener("click",()=>{try{latest=checkMissing(source.value,output.value);present(latest);results.scrollIntoView({behavior:"smooth",block:"nearest"});}catch(e){warning(e.message);}});
el("example-btn").addEventListener("click",()=>{source.value="- Must verify signed payment webhooks\n- Include a cancellation flow\n- Provide accessible mobile navigation\n- Prevent duplicate bookings";output.value="Implemented cancellation flow, mobile navigation, and duplicate booking prevention.";source.dispatchEvent(new Event("input"));el("check-btn").click();});
el("load-url").addEventListener("click",async()=>{
const button=el("load-url"),status=el("url-status"),api=(window.MISSING_AI_API_BASE||"").replace(/\/$/,"");
if(!api){status.textContent="URL loading isn't configured yet. Paste the page content instead.";return;}
button.disabled=true;status.textContent="Loading public webpage…";
try{const res=await fetch(api+"/api/fetch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({url:el("source-url").value})});const body=await res.json();if(!res.ok||!body.ok)throw new Error(body.error||"Source unavailable");source.value=body.text;source.dispatchEvent(new Event("input"));status.textContent="Loaded "+body.url+". Review the extracted text before checking.";}catch(err){status.textContent="Could not load URL: "+err.message+". Paste text instead.";}finally{button.disabled=false;}
});

const exampleJump=el("example-jump");
if(exampleJump)exampleJump.addEventListener("click",()=>{
  source.value="- Must provide payment receipts.\n- Allow customers to cancel bookings.";
  output.value="Payment receipts have not been implemented. Customers can cancel bookings from their dashboard.";
  source.dispatchEvent(new Event("input"));
  el("check-btn").click();
  el("checker").scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"start"});
});
const copyPrompt=el("copy-mcp-prompt");
if(copyPrompt)copyPrompt.addEventListener("click",async()=>{
  const message=[
    "Use the connected Missing AI prepare_bundle and validate_bundle tools for this review.",
    "Read only the public HTTPS URLs I select and compare them with my supplied AI answer.",
    "Group only genuinely equivalent requirements while preserving all original source references.",
    "Distinguish mandatory, recommended, conditional and contextual guidance.",
    "For covered or contradicted claims, quote the answer verbatim with exact character offsets.",
    "Do not claim independent implementation or semantic verification.",
    "",
    "Selected public source URLs: [paste up to three public URLs]",
    "AI answer: [paste an answer with no confidential or personal data]"
  ].join("\n");
  const status=el("copy-prompt-status");
  try{
    await navigator.clipboard.writeText(message);
    status.textContent="Prompt copied. Use only non-sensitive public-source material in the controlled beta.";
  }catch{
    status.textContent="Copy unavailable. Open the example workflow in the GitHub documentation instead.";
  }
});
