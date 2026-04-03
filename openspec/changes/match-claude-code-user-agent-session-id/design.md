## Context

The bridge currently sets `User-Agent` to a bridge-specific static value and generates `X-Mcp-Client-Session-Id` inside each connector proxy connection path. Claude Code uses a different identity model: `User-Agent` is composed from runtime/version metadata, and session ID is process/session scoped. This mismatch creates avoidable drift in protocol verification, local HTTP mock behavior, and debugging evidence captured during manual checks.

## Goals / Non-Goals

**Goals:**
- Match Claude Code semantics for MCP proxy identity headers in this bridge.
- Centralize identity header generation so all proxy requests use one source of truth.
- Preserve existing discovery/proxy behavior while changing only identity header lifecycle/format.
- Add tests that lock in parity behavior and prevent regressions.

**Non-Goals:**
- Refactor the full CLI command architecture in this change.
- Change Anthropic discovery endpoint contracts or token refresh behavior.
- Introduce new authentication flows or additional connector capabilities.

## Decisions

1. Introduce a shared MCP identity helper module.
   - Decision: Add a small module responsible for `getMcpUserAgent()` and `getMcpClientSessionId()`.
   - Rationale: Removes duplicated/inline header construction and makes parity testable in isolation.
   - Alternatives considered:
     - Keep inline construction in each connector call path (rejected: repeats logic and invites drift).
     - Store identity values in environment variables only (rejected: weaker defaults and harder parity guarantees).

2. Implement Claude Code-style User-Agent composition.
   - Decision: Use `claude-code/<package-version>` with optional suffix parts derived from `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_AGENT_SDK_VERSION`, and `CLAUDE_AGENT_SDK_CLIENT_APP`.
   - Rationale: Matches observed Claude Code behavior and improves protocol parity for mocks and diagnostics.
   - Alternatives considered:
     - Keep `claudeai-mcp-bridge/<version>` (rejected: known mismatch with target behavior).
     - Hardcode `claude-code/<version> (cli)` (rejected: misses valid optional metadata semantics).

3. Use one process-scoped client session ID.
   - Decision: Generate session ID once per process lifecycle (module-scope UUID) and reuse it for all MCP proxy requests.
   - Rationale: Matches Claude Code session lifecycle and avoids per-connector session churn.
   - Alternatives considered:
     - Per-connector UUID (current behavior, rejected: mismatched lifecycle).
     - Per-request UUID (rejected: highest drift and noisier diagnostics).

4. Validate parity via unit and integration-facing checks.
   - Decision: Add unit tests for UA composition/session reuse and update manual mock verification docs to assert these headers.
   - Rationale: Ensures durable parity and easier future protocol drift audits.

## Risks / Trade-offs

- [Risk] Header parity may still drift if upstream Claude Code changes composition rules. → Mitigation: Keep helper isolated and verify against protocol drift check process.
- [Risk] Reusing one session ID could expose assumptions in existing local tests expecting per-connector UUIDs. → Mitigation: Update tests/docs in the same change and make behavior explicit.
- [Trade-off] Using Claude Code-style UA reduces bridge-specific branding in wire logs. → Mitigation: retain bridge-specific debug logs in stderr and docs.

## Migration Plan

1. Add shared identity helper and switch proxy transport code paths to use it.
2. Remove per-connector session ID creation where replaced.
3. Add/adjust tests for identity behavior.
4. Update protocol-drift and setup docs with new expected headers.
5. Run typecheck/tests and perform local curl/mock verification.

Rollback strategy: restore previous header construction and session ID generation by reverting helper wiring changes if runtime compatibility issues are discovered.

## Open Questions

- Should this change also update any external-facing examples that currently show `claudeai-mcp-bridge/0.1.0` as `User-Agent`?
- Should we surface the generated session ID in debug logs for easier correlation, or keep it header-only?
