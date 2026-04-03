# Manual Claude Code Protocol Drift Check

This guide defines the manual-first process for checking MCP protocol drift between official `@anthropic-ai/claude-code` releases and current runtime behavior.

## 1) Pinned Known-Good Model

- `pinned_version`: last version that passed both static signature and runtime canary checks.
- `candidate_version`: newer version under evaluation.
- Promotion rule:
  - Promote pin only when classification is `safe`.
  - Hold pin for `break-risk`.
  - For `watch`, require explicit maintainer decision and rationale in report notes.

## 2) Static Signature Markers (Required)

Capture at least the following markers from package artifacts:

- Discovery path: `/v1/mcp_servers?limit=1000`
- Proxy path: `/v1/mcp/{server_id}`
- Local proxy path (dev): `/v1/toolbox/shttp/mcp/{server_id}`
- Proxy host constant: `mcp-proxy.anthropic.com`
- Required session header: `X-Mcp-Client-Session-Id`
- Beta/version header markers: `anthropic-beta`, `anthropic-version`, `mcp-servers-...`
- Auth scope marker: `user:mcp_servers`
- Streamable HTTP accept marker: `application/json, text/event-stream`
- Session error signal: `"code":-32001`

## 3) Repeatable Static Check Commands

Use a temporary directory so the repository is not modified.

```bash
mkdir -p /tmp/claude-code-protocol-check && cd /tmp/claude-code-protocol-check

npm view "@anthropic-ai/claude-code" dist-tags --json
npm view "@anthropic-ai/claude-code" time --json

npm pack "@anthropic-ai/claude-code@<pinned_version>"
npm pack "@anthropic-ai/claude-code@<candidate_version>"

mkdir -p v-pinned v-candidate
tar -xzf "anthropic-ai-claude-code-<pinned_version>.tgz" -C v-pinned
tar -xzf "anthropic-ai-claude-code-<candidate_version>.tgz" -C v-candidate

rg -n "mcp-proxy\.anthropic\.com|/v1/mcp/\{server_id\}|/v1/toolbox/shttp/mcp/\{server_id\}|/v1/mcp_servers\?limit=1000|mcp-servers-|X-Mcp-Client-Session-Id|anthropic-beta|anthropic-version|user:mcp_servers|application/json, text/event-stream|\"code\":-32001" \
  v-pinned/package/cli.js \
  v-candidate/package/cli.js

npm view "@anthropic-ai/claude-code@<pinned_version>" dist --json
npm view "@anthropic-ai/claude-code@<candidate_version>" dist --json
```

## 4) Runtime Canary Steps

From repository root:

```bash
CLAUDE_CODE_UA_VERSION=<candidate_version> bun run src/poc-discover.ts
```

Expected minimum checks:

- Discovery succeeds (`/v1/mcp_servers`) and returns at least one server.
- Proxy connection attempt succeeds for at least one server.
- `tools/list` works and returns tools for at least one server.
- Runtime evidence includes MCP identity header parity for proxy calls:
  - `User-Agent` follows `claude-code/<version>` with optional Claude Code suffix parts.
  - The runtime `User-Agent` version should reflect `CLAUDE_CODE_UA_VERSION=<candidate_version>` when simulating the candidate release.
  - `X-Mcp-Client-Session-Id` stays stable for multiple proxy requests in one process run.

## 5) Minimum Evidence to Capture

Each run must include:

- `run_timestamp`
- `pinned_version`
- `candidate_version`
- static results (markers found/missing and relevant diffs)
- runtime results (pass/fail plus key status/error text)
- identity header parity evidence (`User-Agent` shape and session-id lifecycle)
- classification (`safe` / `watch` / `break-risk`)
- decision (`promote` / `hold`)
- notes (especially if decision requires judgment)

## 6) Break-Risk Stop Conditions

Classify as `break-risk` immediately if any of these happen:

- Runtime canary fails discovery/proxy/tool-list behavior.
- Required marker appears removed or materially changed in candidate and runtime also fails.
- Candidate introduces incompatible contract behavior verified by runtime output.

When `break-risk` is reached:

- Stop pin promotion.
- Record blocking evidence in report.
- Keep existing pin until follow-up investigation resolves issue.

## 7) Classification and Decision Rules

- `safe`
  - Static: no critical drift
  - Runtime: pass
  - Decision: `promote`

- `watch`
  - Static: drift detected but not clearly breaking
  - Runtime: pass
  - Decision: default `hold` unless maintainer explicitly approves promotion

- `break-risk`
  - Runtime: fail, or critical contract drift confirmed
  - Decision: `hold`

## 8) Ambiguous Cases Guidance

When static drift is present but runtime passes:

- Classify as `watch`.
- Do not assume immediate breakage.
- Decide promotion explicitly and justify in notes.
- Prefer another follow-up run after next release before broad rollout.

## 9) Report Storage and Naming Convention

- Location (manual phase): `ideas/protocol-drift/reports/`
- File name: `<YYYY-MM-DD>_<pinned_version>_to_<candidate_version>.md`
  - Example: `2026-04-03_2.1.84_to_2.1.91.md`
