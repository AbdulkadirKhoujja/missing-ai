# Missing AI — reuse the existing Orchestryn Hetzner host (no Render)

This is an **isolated sidecar deployment**, not an Orchestryn plugin installed into the control plane. GitHub Pages hosts the public web app. The existing Hetzner VM and Caddy reverse proxy may host Missing AI's independent Node.js API + remote MCP endpoint.

**Status:** deployment files prepared for host-operator review; **not** evidence the service or DNS has been deployed.

## Why a separate sidecar?

The private Orchestryn control plane currently binds its service to host loopback port 3000, uses its own protected GitHub, supervisor and task credentials, and must remain available for approved Upwork work. A public arbitrary-URL retrieval tool must **never** be added to the Orchestryn supervisor's authenticated MCP endpoint or attached to Orchestryn's database, secrets, Docker network or compose lifecycle.

Keep:
- Repository: `AbdulkadirKhoujja/missing-ai` (public source); no secrets.
- Container: `missing-ai-api` on the existing Hetzner host.
- Network: stand-alone `missing-ai_missing_ai` bridge; no connection to Orchestryn's private network.
- Host port: **127.0.0.1:3101** only; no exposed firewall opening.
- HTTPS: independent Caddy virtual host, proposed `https://missing-ai-api.orchestryn.com` after DNS is explicitly configured.
- Remote MCP: `https://missing-ai-api.orchestryn.com/mcp`; website backend origin: `https://missing-ai-api.orchestryn.com`.
- Domain is an illustration of intended DNS setup, **not** a verified live hostname or owned Missing AI brand domain.

## Host deployment (operator-reviewed, separate from Orchestryn Compose)

Preflight on Hetzner: inspect available CPU, RAM and disk; verify Docker Compose is available; check existing Caddy configuration; confirm `127.0.0.1:3101` is unoccupied. Require host admin approval for changes to running processes and DNS.

```bash
# On the existing Hetzner server, deploy Missing AI independently.
sudo git clone https://github.com/AbdulkadirKhoujja/missing-ai.git /opt/missing-ai
cd /opt/missing-ai
sudo docker compose -f deploy/hetzner/compose.missing-ai.yml config --quiet
sudo docker compose -f deploy/hetzner/compose.missing-ai.yml up -d --build
curl --fail-with-body http://127.0.0.1:3101/health
```

In a production operation, pin a reviewed commit SHA rather than deploying arbitrary latest main. Check `docker compose ps`, the health status and resource usage. The project can be stopped independently, without restarting Orchestryn:

```bash
sudo docker compose -f deploy/hetzner/compose.missing-ai.yml down
```

**Caddy / DNS:** Add the separate vhost from `deploy/hetzner/Caddyfile.missing-ai.example` to the existing Caddy configuration, without removing or replacing any current `api.orchestryn.com` handlers. Point the new DNS hostname to the existing host (under domain owner control), validate Caddy's **complete actual configuration** using `caddy validate` or the locally appropriate service/container command, and reload Caddy gracefully. The sample does not operate DNS or Caddy on its own. Leave host port 3101 loopback-only and expose only HTTPS 443 through the existing proxy.

```bash
bash deploy/hetzner/smoke.sh https://missing-ai-api.orchestryn.com
```

**Publish the browser connection:** only after live smoke and a sample public URL fetch are confirmed, update *both* `site/config.js` and `config.js` in the Missing AI repository:

```js
window.MISSING_AI_API_BASE = "https://missing-ai-api.orchestryn.com";
```

Merge with CI proof; verify GitHub Pages homepage, browser-side check, URL import, CORS and mobile layout. The Pages site remains `https://abdulkadirkhoujja.github.io/missing-ai/`.

**Connectors:** Add the same `https://missing-ai-api.orchestryn.com/mcp` endpoint as a remote custom MCP connector in supported ChatGPT and Claude accounts. Installation in each application and any public directory listing require separate real client-side validation/approval. Anonymous remote MCP is for a controlled beta only; add robust authentication, edge rate limits, abuse monitoring and a privacy assessment before promoting it broadly.

## Security and reliability boundaries

- Resource limits are set in the independent Compose service; monitor for contention with Orchestryn and stop this sidecar first if needed.
- The service has no Docker socket, no privileged mode, no shared volume, no Orchestryn secrets, a non-root user and read-only root filesystem.
- URL retrieval blocks non-HTTPS schemes, obvious private-IP targets and private DNS destinations, pins the resolved public IP during TLS fetches, enforces redirect revalidation, timeouts and size limits. Continue security testing: URL-fetching is sensitive functionality and should be considered experimental until a dedicated review.
- The in-memory rate limiter keys by the request's verified loopback Caddy peer + a Caddy-overwritten `X-Forwarded-For` client IP. Only a loopback peer may supply that identity; remote users cannot set it directly. Preserve the exact `header_up X-Forwarded-For {remote_host}` line in the sample Caddy vhost, and do not expose the Node backend to the public network. This is a beta-only rate limiter, not distributed abuse protection; add edge quotas and monitoring before scaling.
- Source web pages are untrusted input; never execute or adopt their embedded instructions.
- The current service intentionally uses no AI provider, persistent storage or usage telemetry. The hosting provider and Caddy may still log metadata. Do not send private assignments, credentials or sensitive personal data to the public endpoint.
- Always deploy this as its **own Compose project**. The Orchestryn `deploy/compose.yml` is a *replacement* stack and must not be changed or combined for this feature.
- Orchestryn's current GitHub Hetzner Ops runner has a strict allowlist and **cannot deploy arbitrary new services**. Do not bypass it, modify shared CI request pointers, or reuse credentials. Use reviewed host-admin deployment or a separately authorised, bounded deployment path later.

## Acceptance evidence

1. Public Pages root actually serves the checker (already verified).
2. Confirm isolated container build and health; inspect the exact host command/run receipt.
3. Confirm Caddy HTTPS, certificate, CORS, `/health`, `/api/check`, `/api/fetch`, and `/mcp` with synthetic requests.
4. Verify browser URL import from a permitted public source; verify private-address fetch refusal.
5. Test actual tool invocation separately in ChatGPT and Claude (not just a unit test).
6. Confirm Orchestryn Upwork account connection, task and supervisory health unchanged before/after deployment.
7. Record exact commit SHA, commands/CI, uptime and rollback plan in Missing AI Issue #3.

This plan uses **no Render**, no new server, and no additional product database.
