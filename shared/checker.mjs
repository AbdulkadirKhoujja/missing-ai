// Deterministic, explainable checklist coverage — NOT a semantic or correctness verifier.
const STOP = new Set("a an and are as at be by can could do does for from have has if in into is it its of on or our should that the their this to using via we will with you your all each must shall required require need needs include includes including ensure provide implement support verify prevent allow use make when where not only then than other which while".split(" "));
const NORM = s => String(s||"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const TOKENS = s => [...new Set(NORM(s).split(/\s+/).filter(x=>x.length>2&&!STOP.has(x)))];
const directive = /\b(must|shall|required|requirements?|should|needs? to|include|ensure|implement|provide|support|verify|prevent|never|do not|cannot|at least|acceptance criteria)\b/i;
const bullet = /^\s*(?:[-*•]\s+|\d{1,3}[.)]\s+|\[[ xX]\]\s*)/;
export function extractRequirements(source) {
  if (typeof source!=="string" || !source.trim()) return [];
  const lines = source.replace(/\r/g,"").split("\n");
  const items = [], seen = new Set();
  for (let i=0;i<lines.length;i++) {
    const raw=lines[i].trim().replace(/^#{1,6}\s+/,"");
    if (raw.length<12 || raw.length>550) continue;
    if (!(bullet.test(lines[i]) || directive.test(raw))) continue;
    const text=raw.replace(/^(?:[-*•]\s+|\d{1,3}[.)]\s+|\[[ xX]\]\s*)/,"").trim();
    const key=NORM(text);
    if (key.length<12 || seen.has(key)) continue;
    seen.add(key);items.push({id:"R"+String(items.length+1).padStart(2,"0"),text,line:i+1});
    if(items.length>=80) break;
  }
  if (!items.length) {
    source.split(/[.!?]\s+/).slice(0,35).forEach((part,i)=>{
      const text=part.trim(); if(text.length>=24 && text.length<=450 && !seen.has(NORM(text))){seen.add(NORM(text));items.push({id:"R"+String(items.length+1).padStart(2,"0"),text,line:null});}
    });
  }
  return items;
}
export function checkMissing(sourceText, aiOutput) {
  if(typeof sourceText!=="string"||typeof aiOutput!=="string"||!sourceText.trim()||!aiOutput.trim()) throw new Error("Both source requirements and AI output are required.");
  if(sourceText.length>30000||aiOutput.length>30000) throw new Error("Maximum 30,000 characters per input.");
  const requirements=extractRequirements(sourceText);
  const normalized=NORM(aiOutput), outputTokens=new Set(TOKENS(aiOutput));
  const findings=requirements.map(r=>{
    const words=TOKENS(r.text);
    const shared=words.filter(w=>outputTokens.has(w));
    const coverage=words.length?shared.length/words.length:0;
    const exact=normalized.includes(NORM(r.text));
    const status=exact?"text_found":coverage>=0.72&&shared.length>=2?"likely_mentioned":"needs_review";
    return {...r,status,coverage:Math.round(coverage*100),matched_terms:shared.slice(0,8),unmatched_terms:words.filter(w=>!outputTokens.has(w)).slice(0,8)};
  });
  return {
    engine:"lexical-v1",status:"review_required",
    summary:{requirements:findings.length,text_found:findings.filter(f=>f.status==="text_found").length,likely_mentioned:findings.filter(f=>f.status==="likely_mentioned").length,needs_review:findings.filter(f=>f.status==="needs_review").length},
    findings,
    limitations:"This free lexical checker identifies requirements not clearly mentioned in the supplied output. It cannot prove an implementation is missing, assess semantic paraphrases reliably, inspect files not supplied, or verify correctness. Review each finding against the source."
  };
}
