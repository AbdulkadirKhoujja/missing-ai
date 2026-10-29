import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../deploy/hetzner/canary-local.sh",import.meta.url));
const script=readFileSync(path,"utf8");
test("canary shell syntax is valid and refuses unspecified target",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
 const result=(()=>{try{execFileSync("bash",[path],{stdio:"pipe"});return 0;}catch(e){return e.status}})();
 assert.equal(result,78);
});
test("canary has no host ports or private network connections",()=>{
 for(const required of [
   "--network none",
   "--read-only",
   "--cap-drop ALL",
   "--security-opt no-new-privileges",
   "--memory 256m",
   "--cpus 0.5",
   "--pids-limit 100",
   "--rm",
   "git -C \"$repo\" archive",
   "CANARY_ALL_PASS",
   "CANARY_PRODUCTION_UNCHANGED_HEALTHY",
   "CANARY_API_MCP_AND_PRIVATE_IP_TESTS_PASS"
 ])assert.ok(script.includes(required),required);
 assert.doesNotMatch(script,/docker compose[\s\S]* up -d|docker stop|docker restart|systemctl restart|network_mode: host/);
 assert.doesNotMatch(script,/(^|\s)(-p|--publish)(\s|=)/);
 assert.doesNotMatch(script,/docker\.sock|\/var\/lib\/orchestryn|\/opt\/orchestryn/);
 assert.match(script,/docker image inspect "\$tag"/);
});
