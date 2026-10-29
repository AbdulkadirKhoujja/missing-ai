// Reproducible PUBLIC benchmark snapshot for the synthetic lexical checker.
// No secrets, network requests, private user cases, or independent semantic "gold".
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {evaluate} from "./evaluate-coverage.mjs";
import {checkMissing} from "../shared/checker.mjs";
import {checkMissingV2} from "../shared/checker-v2.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));
const read=p=>JSON.parse(readFileSync(new URL("../"+p,import.meta.url),"utf8"));
const pct=x=>x===null?"n/a":(x*100).toFixed(1)+"%";
function brief(x){const r=x.confusion,m=x.metrics;
 return {engine:x.engine,case_count:x.n,author_label_status:x.annotation_status,labels:x.labels,confusion:r,
  metrics:{precision:m.precision,recall:m.recall,false_positive_rate:m.false_positive_rate,specificity:m.specificity,uncertain_review_rate:m.uncertain_review_rate},
  by_domain:x.by_domain};
}
export function buildPublicBenchmark({sha="local-unverified",timestamp="1970-01-01T00:00:00.000Z"}={}){
 if(!/^[a-f0-9]{40}$/.test(sha)&&sha!=="local-unverified")throw new Error("Invalid commit SHA");
 const base=read("benchmarks/coverage-v1.json"),challenge=read("benchmarks/challenge-v1.json");
 const out=[
  {label:"lexical-v1 published checker / base synthetic fixture",entry:brief(evaluate(base.cases,checkMissing,base)),source:"benchmarks/coverage-v1.json",production:true},
  {label:"lexical-v1 published checker / later synthetic challenge",entry:brief(evaluate(challenge.cases,checkMissing,challenge)),source:"benchmarks/challenge-v1.json",production:true},
  {label:"lexical-v2 EXPERIMENTAL candidate / base synthetic fixture",entry:brief(evaluate(base.cases,checkMissingV2,base)),source:"benchmarks/coverage-v1.json",production:false},
  {label:"lexical-v2 EXPERIMENTAL candidate / later synthetic challenge",entry:brief(evaluate(challenge.cases,checkMissingV2,challenge)),source:"benchmarks/challenge-v1.json",production:false}
 ];
 return {
  schema:"missing-ai-public-synthetic-benchmark-v1",
  evidence:"AUTO-GENERATED FROM OPEN-SOURCE SYNTHETIC FIXTURES; NOT INDEPENDENTLY HUMAN ADJUDICATED; NOT REAL-WORLD RELIABILITY",
  scope:"answer wording coverage only, never implementation or semantic truth",
  release_commit:sha,generated_utc:timestamp,production_engine:"lexical-v1",
  public_metric_status:"provisional synthetic fixture only",
  semantic_benchmark_status:"Not independently adjudicated; independent accuracy publication blocked (issue #29).",
  datasets:out,
  limitations:["Author-supplied synthetic labels; no independent truth validation.",
   "Candidate lexical-v2 is not deployed or production.",
   "Small nonrandom cases do not represent real users.",
   "A quote or coverage judgment does not demonstrate implemented functionality.",
   "A daily rerun of unchanged code/fixtures is not an improvement or independent replication."]
 };
}
export function renderSummary(r){
 let text=[
  "## Missing AI — public synthetic answer-coverage benchmark",
  "",
  "**Author-labelled synthetic cases, NOT independently adjudicated accuracy.**",
  "Commit: \`"+r.release_commit+"\` | Run (UTC): "+r.generated_utc,
  "This measures how the published lexical checker and an experimental candidate respond to fictional answers—not code correctness, semantic truth, or real-world accuracy.",
  "",
  "| Fixture and engine | Cases | Omitted recall* | Covered false-alarm rate* |",
  "|---|---:|---:|---:|"
 ];
 for(const x of r.datasets){text.push("| "+x.label+" | "+x.entry.case_count+" | "+pct(x.entry.metrics.recall)+" | "+pct(x.entry.metrics.false_positive_rate)+" |");}
 text.push("","*Percentages relative to author-authored synthetic labels only. Do not advertise as independently verified precision or reliability.","",
  "Semantic benchmark: **not adjudicated**. See [independent review gate](https://github.com/AbdulkadirKhoujja/missing-ai/issues/29).");
 return text.join("\n")+"\n";
}
const args=process.argv.slice(2);
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const i=args.indexOf("--out");if(i<0||!args[i+1]||args.filter(x=>x==="--out").length!==1)throw Error("Use: node scripts/publish-public-benchmark.mjs --out DIRECTORY");
 const out=resolve(args[i+1]);
 const r=buildPublicBenchmark({sha:process.env.GITHUB_SHA||"local-unverified",timestamp:new Date().toISOString()});
 mkdirSync(out,{recursive:true});
 writeFileSync(resolve(out,"synthetic-results.json"),JSON.stringify(r,null,2)+"\n");
 writeFileSync(resolve(out,"summary.md"),renderSummary(r));
 console.log("PUBLIC_SYNTHETIC_BENCHMARK_PASS production=lexical-v1 datasets=4 sha="+r.release_commit);
}
