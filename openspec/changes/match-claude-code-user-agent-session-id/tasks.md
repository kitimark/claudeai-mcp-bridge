## 1. Shared MCP identity helpers

- [ ] 1.1 Add a shared helper module that exposes `getMcpUserAgent()` with Claude Code-compatible composition rules.
- [ ] 1.2 Add a process-scoped session ID helper (`getMcpClientSessionId()`) that is initialized once and reused.

## 2. Proxy transport header wiring

- [ ] 2.1 Update `src/server.ts` proxy transport setup to use shared identity helpers for `User-Agent` and `X-Mcp-Client-Session-Id`.
- [ ] 2.2 Update `src/poc-discover.ts` proxy transport setup to use the same identity helpers for parity.
- [ ] 2.3 Remove per-connector session UUID generation where it is replaced by process-scoped identity.

## 3. Verification and tests

- [ ] 3.1 Add unit tests for User-Agent composition with and without optional env metadata.
- [ ] 3.2 Add tests that assert session ID is stable across multiple connector/proxy requests in one process and changes after process restart boundaries.
- [ ] 3.3 Add/adjust integration-facing checks to verify proxy requests include `Authorization`, `User-Agent`, and `X-Mcp-Client-Session-Id`.

## 4. Documentation updates

- [ ] 4.1 Update protocol drift documentation to include identity header parity evidence (`User-Agent` composition and session ID lifecycle).
- [ ] 4.2 Update setup/mock verification docs so local curl/mock checks assert the new parity header expectations.

## 5. Final validation

- [ ] 5.1 Run `bunx tsc --noEmit` and fix any type issues introduced by identity helper wiring.
- [ ] 5.2 Run `bun test` (or targeted tests) and confirm new parity checks pass.

## 6. Post-implementation E2E verification

- [ ] 6.1 Run `CLAUDEAI_MCP_DEBUG=1 bun run src/poc-discover.ts` against live Anthropic APIs.
- [ ] 6.2 Confirm discovery succeeds (`/v1/mcp_servers`) and at least one connector completes proxy connect + `tools/list`.
- [ ] 6.3 Classify any failures as token/scope vs discovery API vs connector auth and record notes before commit.
- [ ] 6.4 Re-run local mock/curl checks to verify `User-Agent` and `X-Mcp-Client-Session-Id` parity after implementation.
