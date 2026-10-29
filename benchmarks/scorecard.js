// Static GitHub Pages synthetic benchmark rendering; no external JS, tracking or AI.
// Strings from JSON are inserted only using textContent, never innerHTML.
const $=id=>document.getElementById(id);
const pct=v=>typeof v==="number"&&Number.isFinite(v)?(v*100).toFixed(1)+"%":"Not measurable";
function cell(tr,value,header=false){
 const td=document.createElement(header?"th":"td");
 td.textContent=String(value);
 if(header)td.scope="row";
 tr.appendChild(td);
}
function reportError(message){
 const node=$("benchmark-status");
 if(node)node.textContent=message;
}
function datasetLabel(x){
 return x.label || "Unlabelled fixture";
}
export function renderBenchmark(snapshot,history){
 if(snapshot?.schema!=="missing-ai-public-synthetic-benchmark-v1"||
    !Array.isArray(snapshot.datasets)||snapshot.datasets.length!==4||
    snapshot.datasets.some(x=>!Number.isSafeInteger(x.entry?.case_count)||x.entry.case_count<1||
      !Number.isInteger(x.entry?.confusion?.true_positive)||x.entry.confusion.true_positive<0||
      !Number.isInteger(x.entry?.confusion?.false_positive)||x.entry.confusion.false_positive<0||
      typeof x.production!=="boolean")){
   throw new Error("Unexpected published benchmark data format.");
 }
 const tbody=$("benchmark-rows");
 if(!tbody)throw new Error("Benchmark table is absent.");
 tbody.replaceChildren();
 for(const x of snapshot.datasets){
  const tr=document.createElement("tr");
  cell(tr,datasetLabel(x),true);
  cell(tr,x.entry.case_count);
  cell(tr,(x.production?"Shipped lexical-v1":"Experimental, not deployed"));
  cell(tr,pct(x.entry.metrics?.recall));
  cell(tr,pct(x.entry.metrics?.false_positive_rate));
  cell(tr,x.entry.confusion.true_positive+" / "+(x.entry.labels?.omitted??"?"));
  cell(tr,x.entry.confusion.false_positive+" / "+(x.entry.labels?.covered??"?"));
  tbody.appendChild(tr);
 }
 const stamp=$("benchmark-stamp");
 if(stamp)stamp.textContent="Release "+String(snapshot.release_commit||"unverified").slice(0,12)+
  " · generated "+String(snapshot.generated_utc||"unknown date")+
  " · fixture labels are author-written, not independent ground truth.";
 if(history?.schema==="missing-ai-synthetic-release-history-v1"&&Array.isArray(history.entries)){
  const historyBody=$("history-rows");
  if(historyBody){
   historyBody.replaceChildren();
   for(const entry of history.entries){
    if(!Array.isArray(entry.measurements))continue;
    for(const measure of entry.measurements){
     const tr=document.createElement("tr");
     cell(tr,String(entry.release_commit||"unknown").slice(0,12),true);
     cell(tr,entry.generated_utc?.slice(0,10)||"unknown");
     cell(tr,(measure.engine||"unknown")+" / "+(measure.fixture||"unknown"));
     cell(tr,measure.cases??"?");
     cell(tr,pct(measure.recall));
     cell(tr,pct(measure.false_alarm_rate));
     historyBody.appendChild(tr);
    }
   }
  }
 }
 reportError("Results loaded from this published release. These statistics concern synthetic author-labelled examples only.");
}
async function load(){
 try{
  const [r,h]=await Promise.all([
   fetch("./synthetic-results.json",{cache:"no-store"}),
   fetch("./history.json",{cache:"no-store"})
  ]);
  if(!r.ok)throw Error("Latest benchmark JSON unavailable (HTTP "+r.status+").");
  const snapshot=await r.json();
  const history=h.ok?await h.json():null;
  renderBenchmark(snapshot,history);
 }catch{
  reportError("Current benchmark figures could not be loaded. Open the raw JSON or GitHub Actions evidence; no numbers have been guessed.");
 }
}
if(typeof document!=="undefined"){
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load,{once:true});
 else load();
}
