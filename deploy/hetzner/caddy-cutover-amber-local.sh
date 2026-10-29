#!/usr/bin/env bash
# One-time, fail-closed Caddy change from verified Green (3102) to Amber (3103).
# Never restarts/edits Missing AI Docker containers or private Orchestryn.
set -Eeuo pipefail
umask 077
site=/etc/caddy/Caddyfile
endpoint=https://api.orchestryn.com/missing-ai
fail(){ echo "MISSING_AI_CUTOVER_REFUSED: $*" >&2; exit 78; }
test "$EUID" -eq 0 || fail "host administrator required"
for bin in python3 docker curl caddy systemctl cp mv mktemp; do
  command -v "$bin" >/dev/null || fail "missing $bin"
done
systemctl is-active --quiet caddy || fail "Caddy is not active"
caddy validate --config "$site" --adapter caddyfile >/dev/null || fail "current Caddy configuration invalid"
for pair in "3000:deploy-control-plane-1" "3101:missing-ai-api" "3102:missing-ai-green-api" "3103:missing-ai-amber-api"; do
  port="$(printf %s "$pair" | cut -d: -f1)"
  name="$(printf %s "$pair" | cut -d: -f2)"
  test "$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null)" = healthy ||
    fail "service unhealthy: $name"
  curl -fsS --max-time 10 "http://127.0.0.1:$port/health" >/dev/null ||
    fail "local HTTP health failed on $port"
done
for name in deploy-chatgpt-lead-1 deploy-claude-supervisor-1 deploy-runtime-bridge-1; do
  test "$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null)" = healthy ||
    fail "private Orchestryn service unhealthy: $name"
done
curl -fsS --max-time 12 https://api.orchestryn.com/health >/dev/null ||
  fail "private Orchestryn HTTPS unavailable"
prior_mcp_status="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://api.orchestryn.com/mcp/chatgpt)" ||
  fail "private Orchestryn MCP HTTPS unavailable"
test "$prior_mcp_status" != 000 || fail "Orchestryn MCP has no HTTP response"

# Permit ONLY the exact current Caddyfile created by reviewed HTTPS installer.
# No unknown sites, imports, security policies, header directives or route edits.
python3 - "$site" <<'PY' || fail "live Caddyfile deviates from reviewed Green configuration"
from pathlib import Path
import sys
current=[line.strip() for line in Path(sys.argv[1]).read_text().splitlines()
         if line.strip() and not line.lstrip().startswith("#")]
expected=[
  "api.orchestryn.com {",
  "handle_path /missing-ai/* {",
  "reverse_proxy 127.0.0.1:3102 {",
  "header_up X-Forwarded-For {remote_host}",
  "header_up -Cookie",
  "header_up -Authorization",
  "}",
  "}",
  "handle {",
  "reverse_proxy 127.0.0.1:3000",
  "}",
  "}"
]
assert current==expected, "unexpected configuration: refuse modification"
PY

# Ensure the corrected backend already fetches through its running server.
curl -fsS --max-time 20 -H 'content-type: application/json' \
  -d '{"url":"https://example.com/"}' http://127.0.0.1:3103/api/fetch |
  python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"] and len(d["text"])>70'
echo AMBER_PRE_CUTOVER_FETCH_PASS

backup="$(mktemp -p /etc/caddy Caddyfile.pre-amber.XXXXXXXX)"
staged="$(mktemp -p /etc/caddy .Caddyfile.amber.XXXXXXXX)"
cp -p "$site" "$backup"
cp -p "$site" "$staged"
changed=0
restore(){
  code=$?
  trap - ERR
  if test "$changed" = 1; then
    echo "MISSING_AI_CUTOVER_ROLLBACK_BEGIN" >&2
    restored="$(mktemp -p /etc/caddy .Caddyfile.restore-amber.XXXXXXXX)" || exit "$code"
    if cp -p "$backup" "$restored" && mv -f "$restored" "$site" &&
       systemctl reload caddy; then
      echo "MISSING_AI_GREEN_ROUTING_RESTORED" >&2
    else
      echo "MISSING_AI_CADDY_MANUAL_RECOVERY_REQUIRED" >&2
    fi
  fi
  if test -f "$staged"; then rm -f "$staged"; fi
  exit "$code"
}
trap restore ERR

python3 - "$staged" <<'PY'
from pathlib import Path
import sys
file=Path(sys.argv[1])
text=file.read_text()
old="reverse_proxy 127.0.0.1:3102 {"
new="reverse_proxy 127.0.0.1:3103 {"
assert text.count(old)==1 and text.count(new)==0, "unexpected proxy references"
file.write_text(text.replace(old,new))
PY
caddy validate --config "$staged" --adapter caddyfile >/dev/null
echo AMBER_CADDY_CANDIDATE_VALID

changed=1
mv -f "$staged" "$site"
systemctl reload caddy

curl -fsS --max-time 12 "$endpoint/health" |
  python3 -c 'import json,sys; d=json.load(sys.stdin); assert d["ok"] is True and d["service"]=="missing-ai"'
echo AMBER_PUBLIC_HTTPS_HEALTH_PASS

curl -fsS --max-time 20 -H 'content-type: application/json' \
  -d '{"url":"https://example.com/"}' "$endpoint/api/fetch" |
  python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["ok"] and len(d["text"])>70'
echo AMBER_PUBLIC_API_FETCH_PASS

curl -fsS --max-time 20 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":17,"method":"tools/call","params":{"name":"fetch_source","arguments":{"url":"https://example.com/"}}}' \
  "$endpoint/mcp" |
  python3 -c 'import json,sys; d=json.load(sys.stdin)["result"];assert d.get("isError") is False and len(d["structuredContent"]["text"])>70'
echo AMBER_PUBLIC_MCP_FETCH_PASS

curl -fsS --max-time 12 -H 'content-type: application/json' \
  -d '{"source_text":"- Must verify signed webhooks","ai_output":"Added homepage."}' \
  "$endpoint/api/check" |
  python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["ok"] and d["report"]["summary"]["needs_review"]==1'
echo AMBER_PUBLIC_CHECK_MISSING_PASS

unsafe_status="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' \
  -H 'content-type: application/json' -d '{"url":"https://127.0.0.1/"}' "$endpoint/api/fetch")"
test "$unsafe_status" = 400 || { echo "AMBER_PUBLIC_PRIVATE_IP_REFUSAL_FAILED=$unsafe_status" >&2; false; }
echo AMBER_PUBLIC_PRIVATE_IP_REJECTION_PASS

headers="$(curl -fsS --max-time 12 -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://abdulkadirkhoujja.github.io' \
  -H 'Access-Control-Request-Method: POST' "$endpoint/api/fetch")"
printf '%s\n' "$headers" | grep -qi '^access-control-allow-origin: https://abdulkadirkhoujja.github.io'
echo AMBER_PUBLIC_CORS_PASS

curl -fsS --max-time 12 https://api.orchestryn.com/health >/dev/null
now_mcp_status="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://api.orchestryn.com/mcp/chatgpt)"
test "$prior_mcp_status" = "$now_mcp_status" ||
  { echo PRIVATE_ORCHESTRYN_MCP_HTTP_STATUS_CHANGED >&2; false; }
for port in 3101 3102 3103; do
  curl -fsS --max-time 8 "http://127.0.0.1:$port/health" >/dev/null
done
echo ORCHESTRYN_AND_BLUE_GREEN_UNCHANGED_PASS

trap - ERR
echo MISSING_AI_AMBER_PUBLIC_CUTOVER_PASS
echo "PUBLIC_MCP_URL=$endpoint/mcp"
echo "PUBLIC_API_ORIGIN=$endpoint"
echo "CADDY_BACKUP=$backup"
echo "GREEN_LOCAL_FALLBACK=http://127.0.0.1:3102"
