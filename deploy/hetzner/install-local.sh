#!/usr/bin/env bash
# One-time, root-executed deployment on the already-owned Hetzner host.
# Does not mutate Orchestryn's compose, database, Caddy config, DNS or secrets.
set -Eeuo pipefail
umask 077

action="${1:-}"
expected_sha="${2:-}"
repo=/opt/missing-ai
compose="$repo/deploy/hetzner/compose.missing-ai.yml"

say() { printf '%s\n' "$*"; }
fail() { say "MISSING_AI_INSTALL_DENIED: $*" >&2; exit 78; }
require_root() { test "${EUID}" -eq 0 || fail "run as root via sudo on the existing Hetzner host"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "required command missing: $1"; }

orchestryn_health() {
  curl --fail --silent --show-error --max-time 8 http://127.0.0.1:3000/health >/dev/null ||
    fail "the existing Orchestryn control plane is not responding"
  for service in control-plane chatgpt-lead claude-supervisor runtime-bridge; do
    mapfile -t ids < <(docker ps -q --filter "label=com.docker.compose.service=$service")
    test "${#ids[@]}" -eq 1 || fail "Orchestryn $service identity is absent or ambiguous"
    state="$(docker inspect "${ids[0]}" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')"
    test "$state" = healthy || fail "Orchestryn $service is $state, not healthy"
  done
}

preflight() {
  require_root
  for name in git docker curl ss free df systemctl; do need "$name"; done
  docker compose version >/dev/null || fail "Docker Compose plugin unavailable"
  systemctl is-active --quiet docker || fail "Docker service is not active"
  systemctl is-active --quiet caddy || fail "Caddy service is not active"
  test -f "$compose" || fail "Missing AI checkout missing at /opt/missing-ai"
  test -d "$repo/.git" || fail "expected a Git checkout of Missing AI"
  test "$(git -C "$repo" remote get-url origin)" = "https://github.com/AbdulkadirKhoujja/missing-ai.git" ||
    fail "repository origin does not match Missing AI"
  test -z "$(git -C "$repo" status --porcelain --untracked-files=no)" ||
    fail "Missing AI has uncommitted tracked modifications"
  docker compose -f "$compose" config --quiet || fail "invalid separate Compose config"
  # Upwork supervisor availability is a prerequisite, not a casualty.
  orchestryn_health
  available_mb="$(free -m | awk '/^Mem:/ {print $7}')"
  test "${available_mb:-0}" -ge 512 || fail "less than 512 MB available RAM"
  space_kb="$(df -Pk /opt | awk 'NR==2{print $4}')"
  test "${space_kb:-0}" -ge 2097152 || fail "less than 2 GiB available disk"
  if ss -H -ltn | awk '$4 ~ /:3101$/ {found=1} END{exit !found}'; then
    fail "loopback port 3101 is already in use"
  fi
  test -z "$(docker ps -aq --filter name='^/missing-ai-api$')" ||
    fail "Missing AI container already exists; avoid replacing it without an upgrade/rollback review"
  say "MISSING_AI_HOST_PREFLIGHT_PASS"
  say "ORCHESTRYN_FOUR_SERVICES_HEALTHY"
  say "CADDY_ACTIVE"
  say "PORT_3101_FREE"
  say "CAPACITY_CHECK_PASS"
}

case "$action" in
  preflight)
    preflight
    ;;
  deploy)
    [[ "$expected_sha" =~ ^[0-9a-f]{40}$ ]] ||
      fail "usage: install-local.sh deploy <reviewed exact 40-character commit SHA>"
    preflight
    actual_sha="$(git -C "$repo" rev-parse HEAD)"
    test "$actual_sha" = "$expected_sha" ||
      fail "checked-out commit differs from reviewed SHA; refusing mutable branch deployment"
    # This must remain an independent Compose project. Never use Orchestryn's compose file.
    say "MISSING_AI_BUILD_BEGIN $actual_sha"
    docker compose -f "$compose" build api
    created=0
    rollback_new_container() {
      code=$?
      if test "$created" = 1; then
        say "MISSING_AI_ROLLBACK_BEGIN" >&2
        docker compose -f "$compose" down --remove-orphans >/dev/null 2>&1 ||
          say "MISSING_AI_MANUAL_ROLLBACK_REQUIRED" >&2
      fi
      exit "$code"
    }
    trap rollback_new_container ERR
    created=1
    docker compose -f "$compose" up -d --no-build api
    ready=0
    for attempt in $(seq 1 24); do
      state="$(docker inspect missing-ai-api --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' 2>/dev/null || true)"
      if test "$state" = healthy; then ready=1; break; fi
      sleep 3
    done
    test "$ready" -eq 1 || { say "MISSING_AI_API_NOT_HEALTHY" >&2; false; }
    curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3101/health |
      grep -q '"ok":true' || { say "MISSING_AI_API_RESPONSE_INVALID" >&2; false; }
    orchestryn_health
    trap - ERR
    say "MISSING_AI_LOCAL_API_DEPLOYED"
    say "SHA=$actual_sha"
    say "LOOPBACK_HEALTH=PASS"
    say "ORCHESTRYN_POST_DEPLOY_HEALTH=PASS"
    say "HTTPS_CADDY_AND_DNS_NOT_CONFIGURED_BY_SCRIPT"
    ;;
  *)
    fail "usage: install-local.sh preflight OR install-local.sh deploy <reviewed-SHA>"
    ;;
esac
