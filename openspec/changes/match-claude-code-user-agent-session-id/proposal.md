## Why

The bridge currently identifies itself with a custom User-Agent and generates a new MCP client session ID per connector connection, which diverges from Claude Code behavior. Aligning these identity headers with Claude Code improves protocol parity and reduces avoidable differences when validating local mocks and troubleshooting connector behavior.

## What Changes

- Add shared MCP identity header logic that mirrors Claude Code's User-Agent format (`claude-code/<version>` plus optional suffix parts from environment variables).
- Generate one process-scoped MCP client session ID and reuse it for all proxy requests within the same bridge run.
- Replace per-connector session ID generation in proxy transport setup with the shared session ID.
- Add automated tests for User-Agent composition and session ID reuse semantics.
- Update documentation for protocol/mocking verification so expected headers match Claude Code parity.

## Capabilities

### New Capabilities
- `claude-code-mcp-identity-parity`: Ensure MCP proxy identity headers emitted by the bridge match Claude Code semantics for User-Agent composition and client session ID lifecycle.

### Modified Capabilities
- `claude-code-protocol-drift-check`: Update protocol drift verification guidance to assert the new header parity contract during manual/local checks.

## Impact

- Affected code: MCP proxy transport setup and shared runtime identity helpers in `src/`.
- Affected tests: new unit tests for header/session identity behavior.
- Affected docs: protocol drift and setup guidance that currently reference previous header behavior.
- No external API contract change; this is internal request identity alignment to match Claude Code.
