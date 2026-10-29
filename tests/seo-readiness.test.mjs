import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const base="https://abdulkadirkhoujja.github.io/missing-ai/";
const pages=["index.html","privacy.html","guides/index.html",
"guides/how-to-check-ai-answer.html","guides/check-ai-assignment-against-rubric.html",
"guides/requirements-coverage-checklist.html","guides/ai-answer-evidence-vs-verification.html"];
const canonicalPath=p=>p.endsWith("index.html")?p.slice(0,-"index.html".length):p;
const canonicals=pages.map(p=>base+canonicalPath(p));
const key="0278792dd20355fb9998929be016b69950b85baa";
test("canonical sitemap exactly matches seven substantive public pages without duplicates",()=>{
 const sitemap=read("site/sitemap.xml");
 const entries=[...sitemap.matchAll(/<loc>(https:[^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.deepEqual(entries,canonicals);
 assert.equal(new Set(entries).size,7);
 assert.equal((sitemap.match(/<lastmod>2026-10-29<\/lastmod>/g)||[]).length,7);
 assert.match(sitemap,/sitemaps\.org\/schemas\/sitemap\/0\.9/);
 for(const p of pages){
  const html=read("site/"+p);
  const url=base+canonicalPath(p);
  assert.ok(html.includes('rel="canonical" href="'+url+'"'),p+" canonical mismatch");
  assert.match(html,/<meta name="description" content="[^"]{40,}/,p+" description missing");
  assert.match(html,/<title>[^<]{15,}/,p+" title missing");
  assert.doesNotMatch(html,/<meta name="robots" content="noindex/i,p+" must not be noindexed");
 }
});
test("structured data matches the visible free web tool and real guide content",()=>{
 const extract=p=>{
  const html=read("site/"+p);
  const snippets=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(snippets.length,1,p+" JSON-LD count");
  return JSON.parse(snippets[0][1]);
 };
 const app=extract("index.html");
 assert.equal(app["@type"],"WebApplication");
 assert.equal(app.url,base);
 assert.equal(app.offers.price,"0");
 assert.equal(app.isAccessibleForFree,true);
 assert.match(app.description,/requirements/i);
 assert.doesNotMatch(JSON.stringify(app),/100%|guaranteed|independently verified/i);
 const collection=extract("guides/index.html");
 assert.equal(collection["@type"],"CollectionPage");
 for(const page of pages.filter(p=>p.startsWith("guides/")&&!p.endsWith("/index.html"))){
  const item=extract(page);
  assert.equal(item["@type"],"Article");
  assert.equal(item.isAccessibleForFree,true);
  assert.equal(item.mainEntityOfPage,base+page);
  assert.equal(item.datePublished,"2026-10-29");
  assert.ok(read("site/"+page).includes(item.headline),page+" heading mismatch");
 }
});
test("every authored site page is mirrored for the root development server",()=>{
 for(const p of [...pages,"styles.css","sitemap.xml","feed.xml","robots.txt","llms.txt",key+".txt"]){
  assert.ok(existsSync(new URL("site/"+p,root)),p);
  assert.equal(read("site/"+p),read(p),"mirror mismatch "+p);
 }
});
test("internal page and guide links resolve to published files",()=>{
 for(const p of pages){
  const html=read("site/"+p);
  const origin=base+canonicalPath(p);
  for(const match of html.matchAll(/\bhref="([^"]+)"/g)){
   const href=match[1];
   if(/^(mailto:|tel:|javascript:)/i.test(href))assert.fail("unsuitable href");
   let url;try{url=new URL(href,origin)}catch{assert.fail("bad link "+href);}
   if(url.origin!==new URL(base).origin||!url.pathname.startsWith("/missing-ai/"))continue;
   let relative=url.pathname.slice("/missing-ai/".length);
   if(!relative||relative.endsWith("/"))relative+="index.html";
   assert.ok(existsSync(new URL("site/"+relative,root)),p+" broken internal link -> "+href);
  }
 }
});
test("search discovery, RSS and project robots caveat are honest",()=>{
 const html=read("site/index.html"),feed=read("site/feed.xml"),robots=read("site/robots.txt");
 assert.match(html,/rel="alternate" type="application\/rss\+xml"/);
 assert.match(feed,/<rss version="2\.0"/);
 assert.equal((feed.match(/<item>/g)||[]).length,4);
 assert.match(robots,/Sitemap: https:\/\/abdulkadirkhoujja\.github\.io\/missing-ai\/sitemap\.xml/);
 assert.match(robots,/not host-root directive|not project subpaths|not host-root/i);
 assert.equal(read("site/"+key+".txt").trim(),key);
});
test("GitHub Pages copies static guides, sitemap, RSS and proof key",()=>{
 const workflow=read(".github/workflows/ci-and-pages.yml");
 assert.match(workflow,/mkdir -p _site\/shared _site\/guides/);
 assert.match(workflow,/cp site\/guides\/\*\.html _site\/guides\//);
 for(const s of ["site/sitemap.xml","site/robots.txt","site/feed.xml","site/llms.txt","site/"+key+".txt"])assert.ok(workflow.includes(s),s);
});

test("optional AI discovery file is transparent and makes no unsupported marketing claims",()=>{
 const doc=read("site/llms.txt");
 assert.match(doc,/optional human-readable discovery file/i);
 assert.match(doc,/no indexing, ranking, chatbot-training, or citation guarantee/i);
 assert.match(doc,/wording-based heuristics/i);
 assert.match(doc,/not an officially listed plugin/i);
});
