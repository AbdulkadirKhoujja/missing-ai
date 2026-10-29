import test from "node:test";
import assert from "node:assert/strict";
import {notificationUrls,extractSitemapUrls,sendIndexNow} from "../scripts/notify-indexnow.mjs";
const base="https://abdulkadirkhoujja.github.io/missing-ai/";
const key="0278792dd20355fb9998929be016b69950b85baa";
test("first introduction of notifier sends each sitemap URL once",()=>{
 const urls=notificationUrls(["scripts/notify-indexnow.mjs","site/index.html"]);
 assert.equal(urls.length,7);
 assert.equal(new Set(urls).size,7);
 assert.ok(urls.includes(base+"guides/"));
});
test("routine edits notify only their changed canonical pages",()=>{
 assert.deepEqual(notificationUrls(["README.md","site/guides/how-to-check-ai-answer.html","site/guides/how-to-check-ai-answer.html"]),[base+"guides/how-to-check-ai-answer.html"]);
 assert.deepEqual(notificationUrls(["docs/marketing/SEO_AEO_GEO_EXECUTION.md","tests/seo-readiness.test.mjs"]),[]);
 assert.deepEqual(notificationUrls(["site/privacy.html","site/guides/index.html"]),[base+"privacy.html",base+"guides/"]);
});
test("sitemap extraction refuses duplicates, mismatched origins or incomplete URLs",()=>{
 const xml='<urlset><loc>'+Array.from({length:7},(_,i)=>base+"page-"+i).join('</loc><loc>')+'</loc></urlset>';
 assert.equal(extractSitemapUrls(xml).length,7);
 assert.throws(()=>extractSitemapUrls(xml.replace("page-6","page-5")),/seven unique/);
 assert.throws(()=>extractSitemapUrls(xml.replace(base+"page-3","https://evil.example.com/test")),/URL mismatch/);
});
test("proof validation precedes any remote notification",async()=>{
 const calls=[];
 const fake=async(url)=>{
  calls.push(url);
  return {ok:false,text:async()=>"Not Found",status:404};
 };
 await assert.rejects(()=>sendIndexNow({changedPaths:["site/index.html"],fetchFn:fake}),/Public keyLocation not reachable/);
 assert.equal(calls.length,1);
});
test("accepted receipt still reports no indexing proof and uses canonical URLs",async()=>{
 const seen=[];
 const fake=async(url,opts)=>{
  seen.push({url,opts});
  if(url===base+key+".txt")return {ok:true,status:200,text:async()=>key};
  return {ok:true,status:202,text:async()=>"Accepted"};
 };
 const result=await sendIndexNow({changedPaths:["site/index.html","site/guides/index.html"],fetchFn:fake});
 assert.equal(result.status,"received_pending_key_review");
 assert.equal(result.http_status,202);
 assert.match(result.disclaimer,/does not guarantee indexing/i);
 assert.equal(seen.length,2);
 assert.equal(seen[1].url,"https://api.indexnow.org/indexnow");
 const payload=JSON.parse(seen[1].opts.body);
 assert.deepEqual(payload.urlList,[base,base+"guides/"]);
 assert.equal(payload.host,"abdulkadirkhoujja.github.io");
 assert.equal(payload.keyLocation,base+key+".txt");
});
test("failed API receipt is never labelled successfully indexed",async()=>{
 const fake=async(url)=>{
  if(url.includes(key+".txt"))return {ok:true,status:200,text:async()=>key};
  return {ok:false,status:422,text:async()=>"Unprocessable"};
 };
 await assert.rejects(()=>sendIndexNow({changedPaths:["site/index.html"],fetchFn:fake}),/IndexNow HTTP 422/);
});
test("non-page changes skip all network calls",async()=>{
 const result=await sendIndexNow({changedPaths:["docs/marketing/SEO_AEO_GEO_EXECUTION.md"],fetchFn:()=>{throw Error("network should not execute");}});
 assert.equal(result.status,"skipped");
 assert.deepEqual(result.urls,[]);
});
