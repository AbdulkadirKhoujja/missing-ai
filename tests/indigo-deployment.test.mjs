import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../deploy/hetzner/indigo-review-local.sh",import.meta.url));
const s=readFileSync(path,"utf8");
const c=readFileSync(new URL("../deploy/hetzner/compose.indigo.yml",import.meta.url),"utf8");
test("Indigo installer syntactically valid and refuses a missing reviewed SHA",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
 let code=0;try{execFileSync("bash",[path],{stdio:"pipe"});}catch(e){code=e.status;}
 assert.equal(code,78);
});
test("candidate is network isolated and does not modify any previous Docker service",()=>{
 for(const x of ["name: missing-ai-indigo","container_name: missing-ai-indigo-api","127.0.0.1:3104:3101","read_only: true","mem_limit: 256m","cpus: 0.5","no-new-privileges:true"])assert.ok(c.includes(x),x);
 assert.doesNotMatch(c,/docker\.sock|privileged:\s*true|\/opt\/orchestryn|127\.0\.0\.1:310[123]:3101/);
 assert.doesNotMatch(s,/git -C "\$repo" checkout|docker (stop|restart|rm -f) missing-ai-api|systemctl (restart|stop)/);
});
test("cutover exact Amber guard, Caddyfile adapter, backup and fallback are present",()=>{
 for(const x of ["reverse_proxy 127.0.0.1:3103 {","reverse_proxy 127.0.0.1:3104 {","reverse_proxy 127.0.0.1:3000","header_up -Authorization","header_up -Cookie","caddy validate --config \"$staged\" --adapter caddyfile","INDIGO_CADDY_ROLLBACK_BEGIN","INDIGO_AMBER_ROUTING_RESTORED","INDIGO_PUBLIC_CUTOVER_PASS","ORCHESTRYN_BLUE_GREEN_AMBER_UNCHANGED_PASS"])assert.ok(s.includes(x),x);
});
test("MCP quote authenticity, original tools, SSRF and CORS tested on both local and public endpoints",()=>{
 for(const x of ["test_services http://127.0.0.1:3104",'test_services "$endpoint"',"prepare_review","validate_review","check_missing","fetch_source","not an exact quotation","semantic_accuracy_verified","https://127.0.0.1/","INDIGO_PUBLIC_CORS_PASS"])assert.ok(s.includes(x),x);
});
