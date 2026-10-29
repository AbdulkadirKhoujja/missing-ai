import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const scriptPath=fileURLToPath(new URL("../deploy/hetzner/green-install-local.sh",import.meta.url));
const script=readFileSync(scriptPath,"utf8");
const compose=readFileSync(new URL("../deploy/hetzner/compose.green.yml",import.meta.url),"utf8");
test("green installer has valid bash and denies missing release",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",scriptPath]));
 let status=0;try{execFileSync("bash",[scriptPath],{stdio:"pipe"});}catch(e){status=e.status;}
 assert.equal(status,78);
});
test("standalone green service is isolated from blue and Orchestryn",()=>{
 for(const value of ["name: missing-ai-green","container_name: missing-ai-green-api","127.0.0.1:3102:3101","read_only: true","cap_drop:","mem_limit: 256m","cpus: 0.5","restart: unless-stopped"])assert.ok(compose.includes(value),value);
 assert.doesNotMatch(compose,/127\.0\.0\.1:3101:3101|\/var\/lib\/orchestryn|docker\.sock|network_mode:\s*host|privileged:\s*true/);
});
test("installer cannot replace running blue image, repo or supervisor",()=>{
 for(const value of ['git -C "$repo" archive','test ! -e "$root"','orchestryn_health','GREEN_API_AND_MCP_PASS','CADDY_DNS_UNCHANGED','MISSING_AI_GREEN_DEPLOYED'])assert.ok(script.includes(value),value);
 assert.doesNotMatch(script,/git -C "\$repo" checkout|docker compose.*\/opt\/orchestryn|docker (stop|restart|rm -f) missing-ai-api\b|systemctl (stop|restart|reload)/);
 assert.match(script,/docker compose -f "\$compose" up -d --build api/);
 assert.match(script,/docker compose -f "\$compose" down --remove-orphans/);
});
