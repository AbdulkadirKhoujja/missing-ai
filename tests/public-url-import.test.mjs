import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=readFileSync(new URL("../config.js",import.meta.url),"utf8");
const site=readFileSync(new URL("../site/config.js",import.meta.url),"utf8");
const index=readFileSync(new URL("../site/index.html",import.meta.url),"utf8");
const app=readFileSync(new URL("../site/app.js",import.meta.url),"utf8");
test("GitHub Pages and repository root use the same public beta backend",()=>{
 assert.equal(root,site);
 assert.match(site,/window\.MISSING_AI_API_BASE = "https:\/\/api\.orchestryn\.com\/missing-ai";/);
 assert.doesNotMatch(site,/https:\/\/.*\/mcp["']/);
 assert.doesNotMatch(site,/(Bearer|api[_-]?key|secret|password)\s*=/i);
});
test("URL importer loads config before app, and imports only on explicit click",()=>{
 assert.ok(index.indexOf('src="./config.js"')<index.indexOf('src="./app.js"'));
 assert.match(app,/el\("load-url"\)\.addEventListener\("click",async/);
 assert.match(app,/fetch\(api\+"\/api\/fetch"/);
 assert.match(app,/body:JSON\.stringify\(\{url:el\("source-url"\)\.value\}\)/);
 assert.match(app,/status\.textContent=/);
});
