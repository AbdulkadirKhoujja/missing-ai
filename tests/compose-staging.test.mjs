import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../deploy/hetzner/compose-staging-local.sh",import.meta.url));
const script=readFileSync(path,"utf8");
test("Compose staging script syntax valid and no-SHA execution denied",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
 let exit;
 try{execFileSync("bash",[path],{stdio:"pipe"});exit=0;}catch(e){exit=e.status;}
 assert.equal(exit,78);
});
test("staging only uses its own project, loopback port and image",()=>{
 for(const required of [
   "project=missing-ai-staging","port=3102",
   'compose.staging.yml',
   "127.0.0.1:3102:3101",
   "docker compose -p \"$project\" -f \"$compose\" up -d --build api",
   "docker compose -p \"$project\" -f \"$compose\" down --remove-orphans --volumes",
   "docker image rm \"$tag\"",
   "COMPOSE_STAGING_API_CHECK_PASS",
   "COMPOSE_STAGING_MCP_PASS",
   "COMPOSE_STAGING_PRODUCTION_UNCHANGED_PASS",
   "COMPOSE_STAGING_ALL_PASS"
 ])assert.ok(script.includes(required),required);
 assert.doesNotMatch(script,/systemctl (stop|restart|reload)/);
 assert.doesNotMatch(script,/docker compose\s+-f "\$repo\//);
 assert.doesNotMatch(script,/docker (stop|restart|rm -f) missing-ai-api\b/);
 assert.doesNotMatch(script,/127\.0\.0\.1:3101:3101.*s\/127\.0\.0\.1:3102:3101/);
 assert.match(script,/git -C "\$repo" archive/);
 assert.match(script,/test "\$\(git -C "\$repo" rev-parse HEAD\)" = "\$baseline"/);
});
