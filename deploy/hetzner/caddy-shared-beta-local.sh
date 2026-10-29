#!/usr/bin/env bash
# One-time controlled-beta route on existing Caddy HTTPS hostname.
# Protect Orchestryn's original authenticated MCP and API routing.
set -Eeuo pipefail
umask 077

site=/etc/caddy/Caddyfile
endpoint=https://api.orchestryn.com/missing-ai
fail(){ echo "MISSING_AI_CADDY_REFUSED: $*" >&2; exit 78; }
test "$EUID" -eq 0 || fail "root required"
for cmd in caddy curl systemctl docker mktemp cp mv chmod chown grep python3; do
  command -v "$cmd" >/dev/null || fail "missing command $cmd"
done
test -f "$site" || fail "Caddyfile not present"
systemctl is-active --quiet caddy || fail "Caddy not active"
caddy validate --config "$site" >/dev/null || fail "existing Caddy config invalid"
for service in missing-ai-green-api missing-ai-api; do
  test "$(docker inspect "$service" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null)" = healthy ||
    fail "expected healthy service $service"
done
for port in 3000 3101 3102; do
  curl -fsS --max-time 10 "http://127.0.0.1:$port/health" >/dev/null ||
    fail "unhealthy existing loopback service on $port"
done
curl -fsS --max-time 12 https://api.orchestryn.com/health >/dev/null ||
  fail "original public HTTPS health not responding"

# Owner inspected exactly three directives. Reject anything that was added
# (including imports, global config, authentication and other virtual hosts).
python3 - "$site" <<'PY' || fail "CADDY_CURRENT_MUST_MATCH the inspected three-line original"
from pathlib import Path
import sys
lines = [x.strip() for x in Path(sys.argv[1]).read_text().splitlines()
         if x.strip() and not x.lstrip().startswith("#")]
expected = ["api.orchestryn.com {", "reverse_proxy 127.0.0.1:3000", "}"]
assert lines == expected, "refusing unexpected live Caddyfile content"
PY

before_mcp="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://api.orchestryn.com/mcp/chatgpt)" ||
  fail "private Orchestryn MCP endpoint unavailable"
test "$before_mcp" != 000 || fail "private MCP returned no HTTP status"

backup="$(mktemp -p /etc/caddy Caddyfile.pre-missing-ai.XXXXXXXX)"
staged="$(mktemp -p /etc/caddy .Caddyfile.missing-ai.XXXXXXXX)"
cp -p "$site" "$backup"
changed=0
rollback(){
  code=$?
  trap - ERR
  if test "$changed" = 1; then
    echo MISSING_AI_CADDY_ROLLBACK_BEGIN >&2
    restore="$(mktemp -p /etc/caddy .Caddyfile.restore.XXXXXXXX)" || exit "$code"
    if cp -p "$backup" "$restore" && mv -f "$restore" "$site" && systemctl reload caddy; then
      echo MISSING_AI_CADDY_PRIOR_CONFIGURATION_RELOADED >&2
    else
      echo MISSING_AI_CADDY_MANUAL_RECOVERY_REQUIRED >&2
    fi
  fi
  test ! -f "$staged" || rm -f "$staged"
  exit "$code"
}
trap rollback ERR

cat >"$staged" <<'CADDY'
api.orchestryn.com {
    handle_path /missing-ai/* {
        reverse_proxy 127.0.0.1:3102 {
            header_up X-Forwarded-For {remote_host}
            header_up -Cookie
            header_up -Authorization
        }
    }

    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
CADDY
chmod 0644 "$staged"
chown root:root "$staged"
caddy validate --config "$staged" >/dev/null
echo CADDY_CANDIDATE_VALID

changed=1
mv -f "$staged" "$site"
systemctl reload caddy

curl -fsS --max-time 12 "$endpoint/health" | grep -q '"ok":true'
echo MISSING_AI_PUBLIC_HTTPS_HEALTH_PASS
curl -fsS --max-time 12 -H 'Content-Type: application/json' \
  -d '{"source_text":"- Must verify signed webhooks","ai_output":"Added a homepage."}' \
  "$endpoint/api/check" | grep -q '"needs_review":1'
echo MISSING_AI_PUBLIC_API_CHECK_PASS
curl -fsS --max-time 12 -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"caddy-smoke","version":"0.1"}}}' \
  "$endpoint/mcp" | grep -q '"name":"missing-ai"'
echo MISSING_AI_PUBLIC_MCP_PASS

curl -fsS --max-time 12 https://api.orchestryn.com/health >/dev/null
after_mcp="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' https://api.orchestryn.com/mcp/chatgpt)"
test "$before_mcp" = "$after_mcp" || { echo PRIVATE_ORCHESTRYN_MCP_STATUS_CHANGED >&2; false; }
echo ORCHESTRYN_HTTPS_AND_MCP_UNCHANGED_PASS

headers="$(curl -fsS --max-time 12 -D - -o /dev/null -X OPTIONS \
  -H 'Origin: https://abdulkadirkhoujja.github.io' \
  -H 'Access-Control-Request-Method: POST' "$endpoint/api/fetch")"
printf '%s\n' "$headers" | grep -qi '^access-control-allow-origin: https://abdulkadirkhoujja.github.io'
echo MISSING_AI_BROWSER_CORS_PASS

trap - ERR
echo MISSING_AI_SHARED_HTTPS_PATH_LIVE
echo "PUBLIC_API_ORIGIN=$endpoint"
echo "PUBLIC_MCP_URL=$endpoint/mcp"
echo "CADDY_BACKUP=$backup"
echo BLUE_AND_GREEN_CONTAINERS_UNCHANGED
