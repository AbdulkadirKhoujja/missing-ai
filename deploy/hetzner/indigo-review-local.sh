#!/usr/bin/env bash
# Guarded standalone Indigo candidate and optional public Caddy cutover.
# No changes to Blue, Green, Amber or private Orchestryn.
set -Eeuo pipefail
umask 077
fail(){ echo "MISSING_AI_INDIGO_REFUSED: $*" >&2; exit 78; }
test "$#" -eq 1 || fail "exact reviewed SHA required"
sha="$1"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "invalid reviewed SHA"
repo=/opt/missing-ai
root=/opt/missing-ai-indigo
baseline=92af431428f7035467b088165c96797500a7939b
site=/etc/caddy/Caddyfile
endpoint=https://api.orchestryn.com/missing-ai
test "$EUID" -eq 0 || fail "root required"
for bin in git docker curl python3 tar caddy systemctl mktemp ss; do
 command -v "$bin" >/dev/null || fail "missing $bin"
done
docker compose version >/dev/null || fail "Compose missing"
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline" || fail "existing Blue checkout HEAD changed"
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" || fail "existing Blue tracked files dirty"
test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" || fail "unexpected repo origin"
test ! -e "$root" || fail "Indigo folder already exists; inspect instead of overwrite"
test -z "$(docker ps -aq --filter 'name=^/missing-ai-indigo-api$')" || fail "Indigo container already exists"
test -z "$(docker image ls -q missing-ai-indigo-api:initial)" || fail "Indigo image already exists"
test -z "$(docker network ls -q --filter 'name=^missing-ai-indigo_missing_ai_indigo$')" || fail "Indigo network already exists"
if ss -H -ltn | awk '$4 ~ /:3104$/ {found=1} END {exit !found}'; then fail "local 3104 port in use"; fi
test "$(df -Pk /opt | awk 'NR==2{print $4}')" -ge 2097152 || fail "disk free below 2GiB"
test "$(free -m | awk '/^Mem:/{print $7}')" -ge 512 || fail "less than 512MiB available RAM"
systemctl is-active --quiet caddy || fail "Caddy inactive"
caddy validate --config "$site" --adapter caddyfile >/dev/null || fail "current Caddy config invalid"
python3 - "$site" <<'PY' || fail "current Caddyfile not the approved Amber configuration"
import sys
from pathlib import Path
actual=[line.strip() for line in Path(sys.argv[1]).read_text().splitlines() if line.strip() and not line.lstrip().startswith("#")]
expected=["api.orchestryn.com {","handle_path /missing-ai/* {","reverse_proxy 127.0.0.1:3103 {","header_up X-Forwarded-For {remote_host}","header_up -Cookie","header_up -Authorization","}","}","handle {","reverse_proxy 127.0.0.1:3000","}","}"]
assert actual==expected, "unrecognized route or new security directive"
PY

existing_health(){
  for pair in "3000:deploy-control-plane-1" "3101:missing-ai-api" "3102:missing-ai-green-api" "3103:missing-ai-amber-api"; do
    port="$(printf %s "$pair" | cut -d: -f1)"
    name="$(printf %s "$pair" | cut -d: -f2)"
    test "$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy || return 1
    curl -fsS --max-time 8 "http://127.0.0.1:$port/health" >/dev/null || return 1
  done
  for name in deploy-runtime-bridge-1 deploy-claude-supervisor-1 deploy-chatgpt-lead-1; do
    test "$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy || return 1
  done
}
existing_health || fail "existing services unhealthy"
curl -fsS --max-time 12 https://api.orchestryn.com/health >/dev/null || fail "existing private public health failed"
before_mcp="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://api.orchestryn.com/mcp/chatgpt)" ||
 fail "existing private MCP unreachable"
echo INDIGO_EXISTING_SERVICES_HEALTHY

git -C "$repo" fetch --no-tags origin main
git -C "$repo" cat-file -e "$sha^{commit}" || fail "unknown commit"
git -C "$repo" merge-base --is-ancestor "$sha" origin/main || fail "SHA not ancestor of main"
mkdir -p "$root"
release="$root/$sha"
mkdir -p "$release"
compose="$release/deploy/hetzner/compose.indigo.yml"
staged=""
backup=""
started=0
changed=0
rollback(){
  code=$?
  trap - ERR
  if [ "$changed" -eq 1 ]; then
    echo INDIGO_CADDY_ROLLBACK_BEGIN >&2
    restore="$(mktemp -p /etc/caddy .Caddyfile.indigo-restore.XXXXXXXX)" || exit "$code"
    if cp -p "$backup" "$restore" && mv -f "$restore" "$site" && systemctl reload caddy; then
      echo INDIGO_AMBER_ROUTING_RESTORED >&2
    else
      echo INDIGO_CADDY_MANUAL_RECOVERY_REQUIRED >&2
    fi
  fi
  if [ "$started" -eq 1 ]; then
    docker logs --tail 30 missing-ai-indigo-api >&2 || true
    docker compose -f "$compose" down --remove-orphans >/dev/null 2>&1 || true
  fi
  if test -n "$staged" && test -f "$staged"; then rm -f "$staged"; fi
  echo "INDIGO_RELEASE_FAILED_EXIT=$code" >&2
  exit "$code"
}
trap rollback ERR

git -C "$repo" archive --format=tar "$sha" | tar -xf - -C "$release"
docker compose -f "$compose" config --quiet
started=1
docker compose -f "$compose" up -d --build api
ready=0
for n in $(seq 1 45); do
  state="$(docker inspect missing-ai-indigo-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || echo absent)"
  if test "$state" = healthy && curl -fsS --max-time 5 http://127.0.0.1:3104/health 2>/dev/null | grep -q '"ok":true'; then
    ready=1
    break
  fi
  sleep 2
done
test "$ready" = 1 || { echo "INDIGO_STARTUP_HEALTH_FAILED_STATE=$state" >&2; false; }
echo INDIGO_HEALTH_PASS

test_services(){
  local base="$1"
  curl -fsS --max-time 18 -H 'content-type: application/json' \
    -d '{"url":"https://example.com/"}' "$base/api/fetch" |
    python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["ok"] and len(d["text"])>70'
  curl -fsS --max-time 12 -H 'content-type: application/json' \
    -d '{"source_text":"- Must verify signed webhooks","ai_output":"Created a landing page."}' "$base/api/check" |
    python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["ok"] and d["report"]["summary"]["needs_review"]==1'
  curl -fsS --max-time 12 -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$base/mcp" |
    python3 -c 'import json,sys;d=json.load(sys.stdin)["result"]["tools"];assert [x["name"] for x in d]==["check_missing","fetch_source","prepare_review","validate_review"]'
  curl -fsS --max-time 12 -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"prepare_review","arguments":{"source_text":"- Must verify Stripe webhooks","ai_output":"I check Stripe event signatures with the signing secret."}}}' "$base/mcp" |
    python3 -c 'import json,sys;d=json.load(sys.stdin)["result"];assert d["isError"] is False;assert d["structuredContent"]["requirements"][0]["id"]=="R01"'
  curl -fsS --max-time 12 -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"validate_review","arguments":{"source_text":"- Must verify Stripe webhooks","ai_output":"I check Stripe event signatures with the signing secret.","assessments":[{"requirement_id":"R01","judgment":"claimed_covered","reason":"The answer claims Stripe event signatures are checked.","evidence":[{"quote":"I check Stripe event signatures with the signing secret.","start":0}]}]}}}' "$base/mcp" |
    python3 -c 'import json,sys;d=json.load(sys.stdin)["result"];assert d["isError"] is False;assert d["structuredContent"]["validation"]["all_supplied_quotes_exact"] is True;assert d["structuredContent"]["validation"]["semantic_accuracy_verified"] is False'
  curl -fsS --max-time 12 -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"validate_review","arguments":{"source_text":"- Must verify Stripe webhooks","ai_output":"I check Stripe event signatures with the signing secret.","assessments":[{"requirement_id":"R01","judgment":"claimed_covered","reason":"The answer claims Stripe event signatures are checked.","evidence":[{"quote":"I independently inspected the code.","start":0}]}]}}}' "$base/mcp" |
    python3 -c 'import json,sys;d=json.load(sys.stdin)["result"];assert d["isError"] is True;assert "not an exact quotation" in d["content"][0]["text"]'
  curl -fsS --max-time 18 -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"fetch_source","arguments":{"url":"https://example.com/"}}}' "$base/mcp" |
    python3 -c 'import json,sys;d=json.load(sys.stdin)["result"];assert d["isError"] is False;assert len(d["structuredContent"]["text"])>70'
  status="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' -H 'content-type: application/json' -d '{"url":"https://127.0.0.1/"}' "$base/api/fetch")"
  test "$status" = 400 || { echo "INDIGO_PRIVATE_IP_REFUSAL_FAILED_HTTP=$status" >&2; false; }
}
test_services http://127.0.0.1:3104
echo INDIGO_LOCAL_API_MCP_EVIDENCE_PASS

backup="$(mktemp -p /etc/caddy Caddyfile.pre-indigo.XXXXXXXX)"
staged="$(mktemp -p /etc/caddy .Caddyfile.indigo.XXXXXXXX)"
cp -p "$site" "$backup"
cp -p "$site" "$staged"
python3 - "$staged" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text()
old="reverse_proxy 127.0.0.1:3103 {"
assert s.count(old)==1 and "reverse_proxy 127.0.0.1:3104 {" not in s
p.write_text(s.replace(old,"reverse_proxy 127.0.0.1:3104 {"))
PY
caddy validate --config "$staged" --adapter caddyfile >/dev/null
echo INDIGO_CADDY_VALID
changed=1
mv -f "$staged" "$site"
systemctl reload caddy
test_services "$endpoint"
echo INDIGO_PUBLIC_API_MCP_EVIDENCE_PASS

headers="$(curl -fsS --max-time 12 -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://abdulkadirkhoujja.github.io' \
  -H 'Access-Control-Request-Method: POST' "$endpoint/api/fetch")"
printf '%s\n' "$headers" | grep -qi '^access-control-allow-origin: https://abdulkadirkhoujja.github.io'
echo INDIGO_PUBLIC_CORS_PASS
curl -fsS --max-time 12 https://api.orchestryn.com/health >/dev/null
after_mcp="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://api.orchestryn.com/mcp/chatgpt)"
test "$before_mcp" = "$after_mcp" || { echo "PRIVATE_ORCHESTRYN_MCP_STATUS_CHANGED" >&2; false; }
existing_health
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline"
trap - ERR
echo INDIGO_PUBLIC_CUTOVER_PASS
echo "INDIGO_SHA=$sha"
echo "PUBLIC_MCP_URL=$endpoint/mcp"
echo "CADDY_BACKUP=$backup"
echo "AMBER_ROLLBACK_LOCAL=http://127.0.0.1:3103"
echo ORCHESTRYN_BLUE_GREEN_AMBER_UNCHANGED_PASS
