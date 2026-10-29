import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {fileURLToPath} from "node:url";
const path=fileURLToPath(new URL("../deploy/hetzner/silver-unified-local.sh",import.meta.url));
const script=readFileSync(path,"utf8");
const compose=readFileSync(new URL("../deploy/hetzner/compose.silver.yml",import.meta.url),"utf8");
test("Silver installer is Bash-valid, rejects missing exact reviewed SHA",()=>{
 assert.doesNotThrow(()=>execFileSync("bash",["-n",path]));
 let status=0;try{execFileSync("bash",[path],{stdio:"pipe"});}catch(e){status=e.status;}
 assert.equal(status,78);
});
test("Silver release isolated on loopback 3106 with independent Compose network",()=>{
 for(const marker of ["name: missing-ai-silver","container_name: missing-ai-silver-api","127.0.0.1:3106:3101","read_only: true","cap_drop:","no-new-privileges:true","mem_limit: 256m"])assert.ok(compose.includes(marker),marker);
 assert.doesNotMatch(compose,/docker\.sock|\/opt\/orchestryn|privileged:\s*true|127\.0\.0\.1:310[12345]:3101/);
});
test("cutover only replaces exact Violet upstream, preserves Orchestryn and all fallback containers",()=>{
 for(const marker of [
 "reverse_proxy 127.0.0.1:3105 {","reverse_proxy 127.0.0.1:3106 {",
 "reverse_proxy 127.0.0.1:3000",
 "header_up -Authorization","header_up -Cookie",
 "missing-ai-api","missing-ai-green-api","missing-ai-amber-api","missing-ai-indigo-api","missing-ai-violet-api",
 "SILVER_CADDY_ROLLBACK_BEGIN","SILVER_VIOLET_ROUTING_RESTORED",
 "VIOLET_ROLLBACK_LOCAL=http://127.0.0.1:3105","ORCHESTRYN_BLUE_GREEN_AMBER_INDIGO_VIOLET_UNCHANGED_PASS",
 'caddy validate --config "$staged" --adapter caddyfile'
 ])assert.ok(script.includes(marker),marker);
 assert.doesNotMatch(script,/git -C "\$repo" checkout|docker (stop|restart|rm -f) missing-ai-api|systemctl (restart|stop)/);
});
test("live local AND public acceptance includes real public pages and grouping evidence",()=>{
 for(const marker of [
 'test_services http://127.0.0.1:3106','test_services "$endpoint"',
 "SILVER_REAL_TWO_PAGE_BUNDLE_PASS","SILVER_DUPLICATE_AND_CITATION_PASS",
 "making-your-service-accessible-an-introduction","testing-for-accessibility",
 "prepare_bundle","validate_bundle","claimed_covered","contradicted",
 "all_source_requirements_accounted_for","all_answer_quotes_exact",
 "groupings_independently_verified","semantic_classifications_verified",
 "https://127.0.0.1/","SILVER_PUBLIC_CORS_PASS"
 ])assert.ok(script.includes(marker),marker);
});
