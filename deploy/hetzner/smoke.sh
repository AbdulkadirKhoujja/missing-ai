#!/usr/bin/env bash
# Run only against a verified Missing AI backend URL; tests use synthetic data.
set -euo pipefail
BASE="${1:?Usage: bash deploy/hetzner/smoke.sh https://your-backend.example.com}"
BASE="${BASE%/}"
case "$BASE" in https://*) ;; *) echo "Must use HTTPS" >&2; exit 2 ;; esac
command -v curl >/dev/null
command -v grep >/dev/null
echo "Testing health"
curl --fail-with-body --silent --show-error --max-time 20 "$BASE/health" | grep -q '"ok":true'
echo "Testing MCP initialization"
curl --fail-with-body --silent --show-error --max-time 20 "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"missing-ai-smoke","version":"0.1"}}}' | grep -q '"name":"missing-ai"'
echo "Testing MCP tool listing"
curl --fail-with-body --silent --show-error --max-time 20 "$BASE/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | grep -q '"name":"check_missing"'
echo "Testing synthetic analysis"
curl --fail-with-body --silent --show-error --max-time 20 "$BASE/api/check" \
  -H 'Content-Type: application/json' \
  -d '{"source_text":"- Must verify signed webhooks","ai_output":"Added a homepage."}' | grep -q '"needs_review":1'
echo "Testing private IP rejection"
STATUS=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 20 "$BASE/api/fetch" \
  -H 'Content-Type: application/json' -d '{"url":"https://127.0.0.1/"}')
test "$STATUS" = 400 || { echo "Private address test returned $STATUS, expected 400" >&2; exit 1; }
echo "PASS: Missing AI backend health, MCP, checker and private-address refusal."
