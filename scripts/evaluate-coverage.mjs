import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {checkMissing} from "../shared/checker.mjs";
import {checkMissingV2} from "../shared/checker-v2.mjs";

const dataPath=fileURLToPath(new URL("../benchmarks/coverage-v1.json", import.meta.url));
const data=JSON.parse(readFileSync(dataPath,"utf8"));
const challengePath=fileURLToPath(new URL("../benchmarks/challenge-v1.json", import.meta.url));
const challengeData=JSON.parse(readFileSync(challengePath,"utf8"));
const safeDivide=(a,b)=>b>0?a/b:null;
export function evaluate(cases=data.cases,check=checkMissing,fixture=data){
  const rows=cases.map(c=>{
    const result=check(c.source_text,c.ai_output);
    if(result.summary.requirements!==1 || result.findings.length!==1){
      throw new Error("Benchmark case "+c.id+" must yield exactly one requirement, got "+result.findings.length);
    }
    const predicted=result.findings[0].status==="needs_review"?"review":"mentioned";
    return {id:c.id,domain:c.domain,kind:c.kind,gold:c.gold,predicted,raw_status:result.findings[0].status,coverage:result.findings[0].coverage};
  });
  const count=(gold,predicted)=>rows.filter(x=>x.gold===gold&&x.predicted===predicted).length;
  const tp=count("omitted","review");
  const fn=count("omitted","mentioned");
  const fp=count("covered","review");
  const tn=count("covered","mentioned");
  const unknownReview=count("uncertain","review");
  const unknownMention=count("uncertain","mentioned");
  return {
    schema_version:1,
    engine:check===checkMissing?"lexical-v1-current-import":check===checkMissingV2?"lexical-v2-candidate":"custom-checker",
    benchmark:fixture===challengeData?challengePath:dataPath,
    annotation_status:fixture.annotation_status,
    n:rows.length,
    labels:{covered:fp+tn,omitted:tp+fn,uncertain:unknownReview+unknownMention},
    confusion:{true_positive:tp,false_negative:fn,false_positive:fp,true_negative:tn,uncertain_review:unknownReview,uncertain_mentioned:unknownMention},
    metrics:{
      precision:safeDivide(tp,tp+fp),
      recall:safeDivide(tp,tp+fn),
      false_positive_rate:safeDivide(fp,fp+tn),
      specificity:safeDivide(tn,tn+fp),
      uncertain_review_rate:safeDivide(unknownReview,unknownReview+unknownMention)
    },
    by_domain:[...new Set(cases.map(x=>x.domain))].map(domain=>{
      const subset=rows.filter(x=>x.domain===domain);
      return {domain,n:subset.length,covered_false_alarms:subset.filter(x=>x.gold==="covered"&&x.predicted==="review").length,omissions_missed:subset.filter(x=>x.gold==="omitted"&&x.predicted==="mentioned").length,uncertain_marked_review:subset.filter(x=>x.gold==="uncertain"&&x.predicted==="review").length};
    }),
    rows
  };
}
const invoked=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(invoked){
  const checker=process.argv.includes("--candidate")?checkMissingV2:checkMissing;
  const fixture=process.argv.includes("--challenge")?challengeData:data;
  const result=evaluate(fixture.cases,checker,fixture);
  if(process.argv.includes("--json"))console.log(JSON.stringify(result,null,2));
  else {
    const c=result.confusion,m=result.metrics;
    const pct=n=>n===null?"n/a":(100*n).toFixed(1)+"%";
    console.log("Missing AI answer-coverage synthetic benchmark: "+result.n+" cases");
    console.log("Gold labels: "+JSON.stringify(result.labels));
    console.log("Omissions detected: "+c.true_positive+" / "+result.labels.omitted+" ("+pct(m.recall)+")");
    console.log("Covered items falsely flagged: "+c.false_positive+" / "+result.labels.covered+" ("+pct(m.false_positive_rate)+")");
    console.log("Review-flag precision: "+pct(m.precision));
    console.log("Uncertain items marked review: "+c.uncertain_review+" / "+result.labels.uncertain);
    console.log("NOTE: synthetic authored labels, not independent human evaluation; answer coverage is not implementation proof.");
  }
}
