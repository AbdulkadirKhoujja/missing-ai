import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../deploy/hetzner/amber-install-local.sh",import.meta.url));
const shell=readFileSync(path,"utf8");
const compose=readFileSync(new URL("../deploy/hetzner/compose.amber.yml",import.meta.url),"utf8");
test("amber installer valid shell and requires exact SHA",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
 let status=0;try{execFileSync("bash",[path],{stdio:"pipe"});}catch(e){status=e.status;}
 assert.equal(status,78);
});
test("amber is an isolated Compose project with no external port",()=>{
 for(const value of ["name: missing-ai-amber","container_name: missing-ai-amber-api","127.0.0.1:3103:3101","read_only: true","mem_limit: 256m","cpus: 0.5","no-new-privileges:true"])assert.ok(compose.includes(value),value);
 assert.doesNotMatch(compose,/127\.0\.0\.1:310[12]:3101|docker\.sock|\/opt\/orchestryn|privileged:\s*true/);
 for(const value of ["AMBER_LIVE_API_FETCH_PASS","AMBER_LIVE_MCP_FETCH_PASS","AMBER_PRIVATE_IP_REJECTION_PASS","BLUE_GREEN_ORCHESTRYN_UNCHANGED_PASS","CADDY_PUBLIC_ROUTE_NOT_CHANGED","git -C \"$repo\" archive","test ! -e \"$root\""])assert.ok(shell.includes(value),value);
 assert.doesNotMatch(shell,/git -C "\$repo" checkout|docker (stop|restart|rm -f) missing-ai-api|systemctl (stop|restart|reload)/);
});
