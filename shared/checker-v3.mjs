// Experimental lexical-v3 checker, NOT deployed: guarded paraphrase groups and localized evidence.\n// This prototype was tuned on authored synthetic development fixtures; it is NOT independent proof.
// Not a semantic implementation verifier. Not imported by the public app or the live API.
import {extractRequirements} from "./checker.mjs";

const STOP=new Set("a an and are as at be been before by can could do does doing each for from had has have if in into is it its of on or our shall should that the their there these this those to via we will with would you your all any every much many must required require requirements need needs include includes including provide provides allowing allow make making then than when where which while using use user-facing".split(" "));
const GROUPS=[
 ["verify","validate","validated","validation","verifies","verification","check","checked","checks","authenticate","authenticating","confirm","confirmed"],
 ["signature","signatures","signed","signing","sign","signatures","signingsecret","constructevent"],
 ["webhook","webhooks","callback","callbacks","event","events"],
 ["payment","payments","paid","pay","paying"],
 ["booking","bookings","booked","reserve","reserved","reservation","reservations"],
 ["duplicate","duplicates","double","twice","overlap","overlapping","deduplicate","deduplicated","deduplication","repeated","repeat"],
 ["prevent","stop","stops","stopped","block","blocks","blocked","reject","rejects","rejected","deny","denied","disallow","refuse","refused","refuses"],
 ["cancel","cancels","cancelled","cancellation","withdraw","withdrawal","withdrawn","dismiss","dismissal"],
 ["customer","customers","users","user","account-holder","account-holders"],
 ["email","emails","mail","mailed"],
 ["accessibility","accessible","accessibility"],
 ["keyboard","keystroke","keystrokes","keys"],
 ["close","closes","closing","dismiss","dismisses","exit","exits"],
 ["popup","popups","dialog","dialogs","modal","modals"],
 ["escape","esc"],
 ["source","sources","reference","references","origin","originating","origins"],
 ["citation","cite","cited","citing","bibliography"],
 ["publication","published","release","released"],
 ["date","dates","year","years"],
 ["request","requests","requested","ask","asks","asked","connection","connections","inbound","incoming"],
 ["reply","respond","response","responses","getback"],
 ["final","closing","end","ending","conclude","conclusion","concluding"],
 ["link","links","url","urls","hyperlink","hyperlinks"],
 ["open","opened","read","reading","review","reviewed"],
 ["criteria","criterion","requirements","requirement","rubric","rubrics","assessment"],
 ["draft","drafting","write","writing","wrote"],
 ["remove","removed","delete","deleted","strip","stripped","deduplicated"],
 ["row","rows","table","tables"],
 ["export","exported","exporting"],
 ["dataset","data","records","record"],
 ["private","internal","rfc1918","loopback","local"],
 ["ip","address","addresses","destination","destinations","target","targets"],
 ["import","imported","importing","fetch","fetching","retrieve","retrieval"],
 ["webpage","webpages","website","websites","page","pages"],
 ["step","steps","instructions","instruction"],
 ["recipe","recipes","ingredients","ingredient"],
 ["peanut","peanuts"],
 ["free","without","exclude","excluding","avoid","avoiding"],
 ["word","words","sentence","sentences"],
 ["under","below","less"],
 ["meeting","meetings","appointment","appointments"],
 ["slot","slots","seats","seat","capacity"],
 ["focus","focused","outlines","outline","indicator","indicators"],
 ["account","accounts","profile","profiles","dashboard"],
 ["policy","policies","regulation","regulations"],
 ["admin","admins","administrator","administrators"],
 ["password","passwords","credentials","credential"],
 ["audit","auditing","audits"],
 ["log","logs","logging"],
 ["refund","refunds","refunded","refunding"],
 ["protected","protect","protecting","protection"],
 ["statistic","statistics","stats","statistical"],
 ["thank","thanking","thanks","gratitude","appreciation"],
 ["recipient","recipients","addressee","reader","readers"],
 ["shellfish","crustacean","crustaceans","shrimp","prawns","prawn"],
 ["transaction","transactions","transactional"],
 ["field","fields","input","inputs"],
 ["label","labels","labelled","announced","announce"],
];
const LEXICON=new Map();
for(const [canonical,...variants] of GROUPS)for(const v of [canonical,...variants]) {
  // Prefer the first assigned meaning when a token appears in multiple groups.
  if(!LEXICON.has(v))LEXICON.set(v,canonical);
}
const norm=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/\b127\.0\.0\.1\b/g," loopback ").replace(/[^\p{L}\p{N}]+/gu," ").trim();
function concept(t){
  const lower=t.toLowerCase();
  if(LEXICON.has(lower))return LEXICON.get(lower);
  if(lower.length>5&&lower.endsWith("ies"))return lower.slice(0,-3)+"y";
  if(lower.length>5&&lower.endsWith("ing"))return lower.slice(0,-3);
  if(lower.length>4&&lower.endsWith("ed"))return lower.slice(0,-2);
  if(lower.length>4&&lower.endsWith("s")&&!lower.endsWith("ss"))return lower.slice(0,-1);
  return lower;
}
function concepts(s){
  return [...new Set((norm(s).match(/[\p{L}\p{N}]+/gu)||[]).filter(t=>t.length>=3&&!STOP.has(t)).map(concept))];
}
function clauses(output){
  const lines=output.match(/[^.!?\n]+[.!?]?/g)||[output];
  let start=0;
  return lines.map(line=>{
    const idx=output.indexOf(line,start);
    start=(idx<0?start:idx)+line.length;
    const trimmed=line.trim();
    const offset=idx<0?0:idx+line.indexOf(trimmed);
    return {text:trimmed,start:offset,end:offset+trimmed.length,tokens:new Set(concepts(trimmed))};
  }).filter(x=>x.text.length>0);
}
function evidenceFor(words,segments){
  let best=null;
  for(const x of segments){
    const overlap=words.filter(w=>x.tokens.has(w));
    const score=overlap.length/(words.length||1);
    if(!best||score>best.score||(score===best.score&&overlap.length>best.overlap.length)){
      best={...x,overlap,score};
    }
  }
  return best&&best.overlap.length?best:null;
}
const deny=/\b(?:not|never|no|cannot|can't|won't|don't|doesn't|didn't|without|failed|fails|missing|omitted|omits|excluded|skipped|disabled|unavailable|unimplemented|not implemented|not supported)\b/i;
const sourceNegation=/\b(?:must not|do not|never|avoid|without|should not|exclude|excluding)\b/i;
function contradiction(r,segment){
  if(!segment)return false;
  const t=segment.text.toLowerCase();
  if(sourceNegation.test(r.text)) {
    // A prohibitive requirement is not contradicted merely because its evidence
    // describes rejecting/avoiding an unsafe operation.
    return /\b(?:but|however)\b.*\b(?:still|allowed|enabled|included|shown)\b/i.test(t);
  }
  if(!deny.test(t))return false;
  // The negative cue must have scope near a matched concept, not be an unrelated
  // warning in a different sentence. Conservative: avoid claiming verified coverage.
  const ts=norm(t).split(/\s+/);
  const positive=ts.map((word,i)=>({word:concept(word),i})).filter(x=>segment.overlap.includes(x.word));
  const negatives=ts.map((word,i)=>({word,i})).filter(x=>/^(not|never|no|cannot|without|failed|fails|missing|omitted|omits|excluded|skipped|disabled|unavailable|unimplemented|dont|doesnt|didnt|cant|wont)$/.test(x.word));
  return positive.some(p=>negatives.some(n=>Math.abs(n.i-p.i)<=5));
}
function negativeCoverage(r,best){
  if(!best||!sourceNegation.test(r.text))return false;
  const t=best.text.toLowerCase();
  // E.g. "avoid peanuts" vs "peanut-free"; not proof that a recipe is safe.
  return /(?:\b(?:free|without|exclude|avoids?|nevers?|not|no|blocked?|rejects?|stops?|prevents?|denied|refused)\b|[a-z]+-free\b)/.test(t)&&best.overlap.length>=2;
}
export function checkMissingV3(sourceText,aiOutput){
  if(typeof sourceText!=="string"||typeof aiOutput!=="string"||!sourceText.trim()||!aiOutput.trim())throw new Error("Both source requirements and AI output are required.");
  if(sourceText.length>30000||aiOutput.length>30000)throw new Error("Maximum 30,000 characters per input.");
  const reqs=extractRequirements(sourceText),segments=clauses(aiOutput);
  const outputNorm=norm(aiOutput);
  const findings=reqs.map(r=>{
    const words=concepts(r.text);
    const selected=evidenceFor(words,segments);
    const hits=selected?.overlap||[];
    const coverage=words.length?hits.length/words.length:0;
    const exact=outputNorm.includes(norm(r.text));
    const opposed=contradiction(r,selected);
    const negative=negativeCoverage(r,selected);
    const likely=(coverage>=0.59&&hits.length>=2)||negative;
    const status=opposed?"needs_review":exact?"text_found":likely?"likely_mentioned":"needs_review";
    const evidence=selected?{text:selected.text,start:selected.start,end:selected.end}:null;
    return {...r,status,coverage:Math.round(coverage*100),
      matched_terms:words.filter(w=>hits.includes(w)).slice(0,8),
      unmatched_terms:words.filter(w=>!hits.includes(w)).slice(0,8),
      evidence,
      assessment:opposed?"potential_contradiction":status==="text_found"?"exact_wording":status==="likely_mentioned"?"possible_paraphrase":"not_clearly_supported",
      evidence_basis:"answer_text_only",
      explanation:opposed?"The most relevant answer sentence contains a negative or exclusion cue near the requirement terms. Review context.":status==="text_found"?"The original wording appears in the answer; this does not verify implementation.":status==="likely_mentioned"?"A nearby answer sentence shares related words or fixed synonym groups. Confirm it addresses the specific instruction.":"No sufficiently close wording was located in one answer sentence. This does not prove the requirement is unimplemented."
    };
  });
  const statusCount=s=>findings.filter(f=>f.status===s).length;
  return {
    engine:"lexical-v3-candidate",status:"review_required",
    summary:{requirements:findings.length,text_found:statusCount("text_found"),likely_mentioned:statusCount("likely_mentioned"),needs_review:statusCount("needs_review")},
    findings,
    limitations:"This experimental deterministic checker uses fixed word-equivalence groups and localized answer snippets. It cannot establish semantic truth, implementation correctness or compliance. Treat every result and any negative cue as a prompt for human verification."
  };
}
