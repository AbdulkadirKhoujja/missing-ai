// Post-deployment IndexNow notification for changed canonical HTML pages.
// Public key is intentionally non-secret. A 200/202 is NOT indexing proof.
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const base="https://abdulkadirkhoujja.github.io/missing-ai/";
const key="0278792dd20355fb9998929be016b69950b85baa";
const keyLocation=base+key+".txt";
const pages=["","privacy.html","guides/","guides/how-to-check-ai-answer.html","guides/check-ai-assignment-against-rubric.html","guides/requirements-coverage-checklist.html","guides/ai-answer-evidence-vs-verification.html"];
const publication=Object.fromEntries(pages.map(p=>["site/"+(!p||p.endsWith("/")?p+"index.html":p),base+p]));
export function notificationUrls(paths){
 if(!Array.isArray(paths))throw new Error("Changed paths must be an array.");
 // One-time bootstrap: script is newly ADDED only in this commit's git diff.
 if(paths.includes("scripts/notify-indexnow.mjs"))return pages.map(p=>base+p);
 const result=new Set();
 for(const changed of paths)if(Object.hasOwn(publication,changed))result.add(publication[changed]);
 return [...result];
}
export function extractSitemapUrls(xml){
 if(typeof xml!=="string")throw new Error("Invalid sitemap.");
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
 if(urls.length!==7||new Set(urls).size!==7)throw new Error("Sitemap requires exactly seven unique URLs.");
 if(urls.some(u=>!u.startsWith(base)||u.includes("?")||u.includes("#")))throw new Error("Sitemap URL mismatch.");
 return urls;
}
export async function sendIndexNow({changedPaths,fetchFn=fetch}){
 const notified=notificationUrls(changedPaths);
 const registered=extractSitemapUrls(readFileSync(fileURLToPath(new URL("../site/sitemap.xml",import.meta.url)),"utf8"));
 if(notified.some(url=>!registered.includes(url)))throw new Error("Unregistered sitemap URL.");
 if(!notified.length)return {status:"skipped",reason:"No public HTML pages changed.",urls:[]};
 const proof=await fetchFn(keyLocation,{signal:AbortSignal.timeout(20000)});
 if(!proof.ok||(await proof.text()).trim()!==key)throw new Error("Public keyLocation not reachable or mismatched; no submission made.");
 const payload={host:"abdulkadirkhoujja.github.io",key,keyLocation,urlList:notified};
 const response=await fetchFn("https://api.indexnow.org/indexnow",{
  method:"POST",headers:{"content-type":"application/json; charset=utf-8"},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)
 });
 const status=response.status;
 const message=(await response.text()).slice(0,500);
 if(![200,202].includes(status))throw new Error("IndexNow HTTP "+status+": "+message+"; not accepted.");
 return {status:status===200?"received":"received_pending_key_review",http_status:status,urls:notified,
  disclaimer:"Notification receipt does not guarantee indexing, ranking or AI citations."};
}
async function main(){
 const before=process.env.BEFORE_SHA||"",after=process.env.AFTER_SHA||"";
 const sha=/^[0-9a-f]{40}$/;
 if(!sha.test(before)||!sha.test(after))throw new Error("Valid before/after commit SHA required.");
 const paths=execFileSync("git",["diff","--name-only",before,after],{encoding:"utf8"}).split("\n").map(x=>x.trim()).filter(Boolean);
 const result=await sendIndexNow({changedPaths:paths});
 console.log("INDEXNOW_RESULT "+JSON.stringify(result));
 if(result.status==="received"||result.status==="received_pending_key_review")
  console.log("INDEXNOW_NOTIFICATION_ACCEPTED_NOT_INDEXING_PROOF");
}
if(process.argv[1]&&process.argv[1].endsWith("notify-indexnow.mjs"))
 main().catch(e=>{console.error("INDEXNOW_NOT_CONFIRMED:",e.message);process.exitCode=1;});
