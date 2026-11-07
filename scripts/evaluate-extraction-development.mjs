// Reproducible extraction-only diagnostic. Not a semantic checker or independent gold.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {extractReviewRequirements} from "../shared/review-extraction.mjs";
const defaultFile=new URL("../benchmark/use-cases-v1/development-60.json",import.meta.url);
export function assessDevelopmentSourceCapture(pack,extract=extractReviewRequirements){
 if(pack?.schema!=="missing-ai-six-use-case-60-development-v1"||
    !Array.isArray(pack.cases)||pack.cases.length!==60||
    !Array.isArray(pack.negative_context_lines)||pack.negative_context_lines.length!==12)
  throw new Error("Unexpected 60-case source-extraction development fixture");
 const ids=new Set(),positive=[],negative=[];
 for(const c of pack.cases){
  if(!c||ids.has(c.id)||!c.id||typeof c.category!=="string"||
     !c.source_text.startsWith("- ")||typeof c.ai_output!=="string"||
     c.oracle?.expected_source_candidate_count!==1)throw Error("Malformed positive case "+String(c?.id));
  ids.add(c.id);
  const items=extract(c.source_text);
  positive.push({id:c.id,category:c.category,expected:1,extracted:items.length,
   captured:items.length===1&&items[0].text===c.source_text.slice(2),source_line:items[0]?.line??null});
 }
 for(const c of pack.negative_context_lines){
  if(!c||ids.has(c.id)||!c.id||typeof c.source_text!=="string"||
     c.oracle?.expected_source_candidate_count!==0)throw Error("Malformed contextual case "+String(c?.id));
  ids.add(c.id);
  const items=extract(c.source_text);
  negative.push({id:c.id,extracted:items.length,false_candidates:items.map(x=>x.text)});
 }
 const groups=[...new Set(positive.map(c=>c.category))];
 if(groups.length!==6||groups.some(g=>positive.filter(x=>x.category===g).length!==10))throw Error("Expected exactly ten positives per category");
 const by_category=groups.map(category=>{
  const s=positive.filter(x=>x.category===category);
  return {category,authored_imperatives:s.length,captured_exactly:s.filter(x=>x.captured).length,
   missed:s.filter(x=>!x.captured).map(x=>x.id)};
 });
 return {schema:"missing-ai-source-capture-development-measurement-v1",
  oracle_status:"AUTHOR_CONSTRUCTED_POSITIVE_AND_CONTEXTUAL_NEGATIVE_LINES_NOT_INDEPENDENT_GOLD",
  positive_examples:positive.length,positive_captured:positive.filter(x=>x.captured).length,
  positive_misses:positive.filter(x=>!x.captured).map(x=>x.id),
  contextual_examples:negative.length,contextual_without_false_candidates:negative.filter(x=>x.extracted===0).length,
  contextual_false_candidate_ids:negative.filter(x=>x.extracted>0).map(x=>x.id),
  by_category,positive,negative,
  limitations:["These metrics concern authored one-line candidate extraction only, not AI answer coverage or actual implementation.",
   "Counts derive from fixture construction assumptions and are NOT independently validated population recall.",
   "No real MCP backend is called: this imports whichever source extractor is in the checked-out repository.",
   "No fresh unseen holdout: fixtures are public and meant for development.",
   "Source line preservation, relative sources and semantic context still require dedicated tests."]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const p=process.argv[2]?resolve(process.argv[2]):defaultFile;
 const file=typeof p==="string"?p:fileURLToPath(p);
 const pack=JSON.parse(readFileSync(file,"utf8"));
 console.log(JSON.stringify(assessDevelopmentSourceCapture(pack),null,2));
}
