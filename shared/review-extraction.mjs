// Conservative actionable-criteria extraction for host semantic reviews.
// Does NOT replace the backward-compatible lexical-v1 parser.
// The host must still review contextual/conditional requirements and omissions.
const normalize=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
const directive=/\b(?:must|shall|required|requires?|need(?:s)? to|should|have to)\b/i;
const imperative=/^(?:include|check|test|verify|validate|provide|allow|support|prevent|publish|ensure|make sure|run|avoid|keep|retain|remove|delete|use|fix|review|start|implement|record|log|restrict|reject|document|compare|send|create|export|ignore)\b/i;
const footers=/^(?:further reading|related guides|useful resources|additional resources|updates to this page|change history|changelog|references|about this page)$/i;
const bullet=/^\s*(?:[-*•]\s+|\d{1,3}[.)]\s+|\[[ xX]\]\s*)/;
const choice=/\b(?:either|one of|any one of|at least one of)\s*:?\s*$/i;

export function extractReviewRequirements(source){
 if(typeof source!=="string"||!source.trim())return [];
 const lines=source.replace(/\r/g,"").split("\n");
 const out=[],seen=new Set();
 let listPolicy=null,groupChoice=null;
 const push=(text,line,kind="directive")=>{
  const clean=text.replace(/\s+/g," ").trim();
  const key=normalize(clean);
  if(clean.length<12||clean.length>550||seen.has(key)||out.length>=80)return;
  seen.add(key);
  out.push({id:"R"+String(out.length+1).padStart(2,"0"),text:clean,line,kind});
 };
 const flushChoice=()=>{
  if(groupChoice&&groupChoice.variants.length){
   push(groupChoice.parent+" "+groupChoice.variants.join("; "),groupChoice.line,"choice_group");
  }else if(groupChoice)push(groupChoice.parent,groupChoice.line,"directive");
  groupChoice=null;
 };
 for(let i=0;i<lines.length&&out.length<80;i++){
  let raw=lines[i].trim().replace(/^#{1,6}\s+/,"");
  if(!raw)continue;
  if(footers.test(raw)){flushChoice();break;}
  let isBullet=bullet.test(raw);
  if(/^(?:[-*•]|\[[ xX]\])$/.test(raw)){
   let next=i+1;
   while(next<lines.length&&!lines[next].trim())next++;
   if(next<lines.length){
    raw="- "+lines[next].trim();
    isBullet=true;
    i=next;
   }
  }
  if(isBullet){
   const content=raw.replace(bullet,"").trim();
   if(groupChoice&&groupChoice.variants.length>0&&(directive.test(content)||imperative.test(content)))flushChoice();
   if(groupChoice){if(content)groupChoice.variants.push(content);continue;}
   if(directive.test(content)||imperative.test(content)||listPolicy==="mandatory"){
    push(content,i+1,"list_item");
   }
   continue;
  }
  flushChoice();
  listPolicy=null;
  // Avoid declaring headings or descriptive resource links to be requirements.
  if(raw.endsWith(":")){
   if(choice.test(raw)&&directive.test(raw)){
    groupChoice={parent:raw,line:i+1,variants:[]};
    continue;
   }
   if(directive.test(raw)){
    listPolicy="mandatory";
    // An independent instruction before an explanatory list remains actionable.
    const first=raw.split(/(?<=[.!?])\s+/)[0];
    if(first!==raw&&directive.test(first))push(first,i+1);
   }
   continue;
  }
  if(directive.test(raw)||imperative.test(raw))push(raw,i+1);
 }
 flushChoice();
 return out;
}
