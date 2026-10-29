#!/usr/bin/env bash
# Launch fixed URL-fetching release independently on 127.0.0.1:3103.
# No modifications to Blue, Green, Orchestryn, Caddy or DNS.
set -Eeuo pipefail
umask 077
sha="${1:-}"
repo=/opt/missing-ai
root=/opt/missing-ai-amber
baseline=92af431428f7035467b088165c96797500a7939b
fail(){ echo "MISSING_AI_AMBER_REFUSED: $*" >&2; exit 78; }
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || fail "exact reviewed commit SHA required"
test "$EUID" -eq 0 || fail "root required"
for cmd in git docker curl tar python3 ss; do command -v "$cmd" >/dev/null || fail "missing $cmd"; done
docker compose version >/dev/null || fail "Compose unavailable"
test -d "$repo/.git" || fail "Blue repo missing"
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline" || fail "Blue repo HEAD changed"
test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" || fail "Blue tracked files dirty"
test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" || fail "unexpected Git origin"
test ! -e "$root" || fail "Amber release directory exists"
test -z "$(docker ps -aq --filter 'name=^/missing-ai-amber-api$')" || fail "Amber container exists"
test -z "$(docker image ls -q missing-ai-amber-api:initial)" || fail "Amber image exists"
test -z "$(docker network ls -q --filter 'name=^missing-ai-amber_missing_ai_amber$')" || fail "Amber network exists"
if ss -H -ltn | awk '$4 ~ /:3103$/ {found=1} END{exit !found}'; then fail "port 3103 occupied"; fi

existing_health(){
  for pair in "3000:deploy-control-plane-1" "3101:missing-ai-api" "3102:missing-ai-green-api"; do
    port="$(printf '%s' "$pair" | cut -d: -f1)"
    name="$(printf '%s' "$pair" | cut -d: -f2)"
    test "$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy || return 1
    curl -fsS --max-time 8 "http://127.0.0.1:$port/health" >/dev/null || return 1
  done
  for name in deploy-chatgpt-lead-1 deploy-claude-supervisor-1 deploy-runtime-bridge-1; do
    test "$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')" = healthy || return 1
  done
}
existing_health || fail "existing services not healthy"
echo AMBER_EXISTING_SERVICES_HEALTHY
git -C "$repo" fetch --no-tags origin main
git -C "$repo" cat-file -e "$sha^{commit}" || fail "target SHA not fetched"
git -C "$repo" merge-base --is-ancestor "$sha" origin/main || fail "target SHA not on main"
test "$(df -Pk /opt | awk 'NR==2{print $4}')" -ge 2097152 || fail "less than 2GiB free"
mkdir -p "$root"
release="$root/$sha"
mkdir -p "$release"
compose="$release/deploy/hetzner/compose.amber.yml"
started=0
on_error(){
  code=$?
  trap - ERR
  if test "$started" = 1; then
    docker logs --tail 30 missing-ai-amber-api >&2 || true
    docker compose -f "$compose" down --remove-orphans >/dev/null 2>&1 || true
  fi
  echo "AMBER_INSTALL_FAILED=$code" >&2
  exit "$code"
}
trap on_error ERR
git -C "$repo" archive --format=tar "$sha" | tar -xf - -C "$release"
docker compose -f "$compose" config --quiet
started=1
docker compose -f "$compose" up -d --build api
ready=0
for n in $(seq 1 45); do
  status="$(docker inspect missing-ai-amber-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || echo absent)"
  if [ "$status" = healthy ] && curl -fsS --max-time 5 http://127.0.0.1:3103/health 2>/dev/null | grep -q '"ok":true'; then
    ready=1
    break
  fi
  sleep 2
done
test "$ready" = 1 || { echo "AMBER_HEALTH_FAILED_STATUS=$status" >&2; false; }
echo AMBER_HEALTH_PASS

curl -fsS --max-time 18 -H 'content-type: application/json' \
  -d '{"url":"https://example.com/"}' http://127.0.0.1:3103/api/fetch |
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d.get("ok") and len(d.get("text",""))>70;print("AMBER_LIVE_API_FETCH_PASS")'

curl -fsS --max-time 18 -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":17,"method":"tools/call","params":{"name":"fetch_source","arguments":{"url":"https://example.com/"}}}' \
  http://127.0.0.1:3103/mcp |
python3 -c 'import json,sys;d=json.load(sys.stdin)["result"];assert d.get("isError") is False and len(d["structuredContent"]["text"])>70;print("AMBER_LIVE_MCP_FETCH_PASS")'

curl -fsS --max-time 12 -H 'content-type: application/json' \
  -d '{"source_text":"- Must verify signed webhooks","ai_output":"Added homepage."}' \
  http://127.0.0.1:3103/api/check |
python3 -c 'import json,sys;d=json.load(sys.stdin);assert d["ok"] and d["report"]["summary"]["needs_review"]==1;print("AMBER_CHECK_MISSING_PASS")'

code="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' \
  -H 'content-type: application/json' -d '{"url":"https://127.0.0.1/"}' \
  http://127.0.0.1:3103/api/fetch)"
test "$code" = 400 || { echo "AMBER_SSRF_REFUSAL_HTTP=$code" >&2; false; }
echo AMBER_PRIVATE_IP_REJECTION_PASS
test "$(git -C "$repo" rev-parse HEAD)" = "$baseline"
existing_health
trap - ERR
echo AMBER_DEPLOYED_AND_TESTED
echo "AMBER_SHA=$sha"
echo AMBER_LOCAL_URL=http://127.0.0.1:3103
echo BLUE_GREEN_ORCHESTRYN_UNCHANGED_PASS
echo CADDY_PUBLIC_ROUTE_NOT_CHANGED
