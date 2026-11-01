// Opt-in local-only conversation-history retrieval. Prior claims are not verified facts.
export const HISTORY_LIMITS={maxFileBytes:25*1024*1024,maxMessages:20000,maxCharacters:12_000_000,maxMessageCharacters:3000,maxConversations:5000};
const STOP=new Set("about after again already also and are been before being but can could did does doing for from had has have here how into its just let like may more must need not now only our out please should some than that the their there these they this those through use used using want were what when where which while will with would you your access give given provided grant granted asking requested issue problem fixed resolved previously".split(" "));
const lower=s=>String(s||"").normalize("NFKC").toLowerCase();
const words=s=>[...new Set((lower(s).match(/[\p{L}\p{N}][\p{L}\p{N}_-]{2,}/gu)||[]).filter(x=>!STOP.has(x)))];
function contentOf(msg){const c=msg?.content||{};return Array.isArray(c.parts)?c.parts.map(p=>typeof p==="string"?p:typeof p?.text==="string"?p.text:"").filter(Boolean).join("\n"):typeof c.text==="string"?c.text:"";}
function iso(t){const v=Number(t);if(!Number.isFinite(v)||v<=0)return null;const d=new Date(v>1e12?v:v*1000);return Number.isFinite(d.getTime())?d.toISOString():null;}
export function importChatGPTExport(data){
 const conversations=Array.isArray(data)?data:data?.conversations;
 if(!Array.isArray(conversations))throw Error("Expected ChatGPT conversations.json array.");
 if(conversations.length>HISTORY_LIMITS.maxConversations)throw Error("Export exceeds 5,000 conversations.");
 const messages=[];let chars=0,skipped=0,ignored=0,truncated=0;
 for(let i=0;i<conversations.length;i++){
  const conv=conversations[i],mapping=conv?.mapping,current=conv?.current_node;
  if(!mapping||typeof mapping!=="object"||!mapping[current]){skipped++;continue;}
  const chain=[],seen=new Set();let id=current;
  while(id&&mapping[id]&&!seen.has(id)&&chain.length<3000){seen.add(id);chain.push({id,node:mapping[id]});id=mapping[id].parent;}
  for(const item of chain.reverse()){
   const msg=item.node.message,role=msg?.author?.role;
   if(role!=="user"&&role!=="assistant"){ignored++;continue;}
   const raw=contentOf(msg).trim();if(!raw){ignored++;continue;}
   if(messages.length>=HISTORY_LIMITS.maxMessages)throw Error("More than 20,000 text messages: select a smaller export.");
   const text=raw.slice(0,HISTORY_LIMITS.maxMessageCharacters);if(raw.length>text.length)truncated++;
   chars+=text.length;if(chars>HISTORY_LIMITS.maxCharacters)throw Error("History exceeds 12 million characters.");
   messages.push({id:String(conv.id||i)+":"+item.id,conversation:String(conv.title||"Untitled chat").slice(0,160),role,date:iso(msg.create_time||conv.create_time),text});
  }
 }
 return {messages,stats:{conversations:conversations.length,messages:messages.length,skipped_branches:skipped,ignored_nontext:ignored,truncated_messages:truncated},limitations:"Only the active conversation branch's user/assistant text is indexed. Attachments, tool/system messages and alternate branches are excluded."};
}
export function addLocalNote(existing,title,text){
 if(!Array.isArray(existing))throw Error("History is invalid.");
 if(typeof title!=="string"||!title.trim()||title.length>160)throw Error("Note title must be 1–160 characters.");
 if(typeof text!=="string"||!text.trim()||text.length>3000)throw Error("Note text must be 1–3,000 characters.");
 if(existing.length>=HISTORY_LIMITS.maxMessages)throw Error("History message limit reached.");
 return [...existing,{id:"note:"+Date.now()+":"+existing.length,conversation:title.trim(),role:"note",date:new Date().toISOString(),text:text.trim()}];
}
function quote(text,matched){const s=lower(text);let at=0;for(const term of matched){const i=s.indexOf(term);if(i>=0){at=i;break;}}const start=Math.max(0,at-90),end=Math.min(text.length,start+360);return (start?"…":"")+text.slice(start,end)+(end<text.length?"…":"");}
function prior(text){
 const s=lower(text);
 const neg=/\b(?:not|never|failed to|could not|couldn't|unable to)\s+(?:have |been )?(?:fixed|resolved|completed|implemented|deployed|configured|enabled|verified|working|done|granted|given|provided|connected)\b/i.test(s);
 const access=/(?:already|previously|confirmed|verified|successfully).{0,100}(?:access|permission|connection|connected|credentials)|(?:access|permission|connection|connected).{0,100}(?:already|granted|provided|confirmed|verified|successful)/s.test(s);
 const done=/\b(?:fixed|resolved|repaired|completed|implemented|deployed|configured|enabled|verified|working|successful|done)\b/i.test(s);
 return {access:access&&!neg,done:done&&!neg};
}
export function reviewContext(history,answer,{maxResults=8}={}){
 if(!Array.isArray(history))throw Error("History must be an array.");
 if(typeof answer!=="string"||!answer.trim()||answer.length>15000)throw Error("Paste an AI answer of 1–15,000 characters.");
 const terms=words(answer).slice(0,100),s=lower(answer);
 const asksAccess=/(?:need|must|please|require|ask|give|grant|provide|share|cannot|can't|unable|don't|do not).{0,100}(?:access|credentials|permission|login|connection|connect)/s.test(s);
 const repeats=/(?:need|must|should|have to|please|require).{0,95}(?:fix|repair|resolve|configure|set up|enable|connect|redo|repeat|do again)/s.test(s);
 const hits=[];
 for(const m of history){
  if(!m||typeof m.text!=="string"||typeof m.conversation!=="string")continue;
  const msgWords=new Set(words(m.conversation+" "+m.text)),matched=terms.filter(w=>msgWords.has(w));
  if(!matched.length)continue;
  const titleWords=new Set(words(m.conversation)),score=matched.length+matched.filter(w=>titleWords.has(w)).length*.5;
  const p=prior(m.text),access=asksAccess&&p.access&&(matched.length>=2||(matched.length===1&&matched[0].length>=5));
  const repeat=repeats&&p.done&&matched.length>=2;
  hits.push({id:m.id,conversation:m.conversation,role:m.role,date:m.date,quote:quote(m.text,matched),matched_terms:matched.slice(0,12),score,kind:access?"possible_access_recheck":repeat?"possible_repeated_work":"related_history"});
 }
 hits.sort((a,b)=>Number(b.kind!=="related_history")-Number(a.kind!=="related_history")||b.score-a.score||String(b.date).localeCompare(String(a.date)));
 const findings=hits.slice(0,Math.max(1,Math.min(20,Number(maxResults)||8)));
 return {engine:"context-lexical-v1",status:"review_required",history_messages:history.length,findings,summary:{potential_overlooks:findings.filter(f=>f.kind!=="related_history").length,related:findings.filter(f=>f.kind==="related_history").length},limitations:"Keyword-based candidates only. Historical conversation claims do not prove past actions or current access. Review original quotes and independently verify state. Semantic omissions may be missed."};
}
