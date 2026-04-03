## Why

The bridge currently depends on MCP protocol details inferred from Claude Code behavior, but those details can change with new CLI releases or backend rollout changes. We need a repeatable manual process to detect protocol drift early and make break-risk decisions before production usage is affected.

## What Changes

- Add a manual protocol-drift check workflow that compares a pinned known-good Claude Code npm version against a candidate newer version.
- Define a protocol signature checklist (discovery URL, proxy path, required headers, session semantics, auth signals) and how to compare it across versions.
- Add a runtime canary checklist to validate live behavior against Anthropic endpoints after static package analysis.
- Add a drift classification rubric (`safe`, `watch`, `break-risk`) and a pin-promotion decision process (`promote` or `hold`).
- Document the evidence format for each run so results are auditable and can later be automated.

## Capabilities

### New Capabilities
- `claude-code-protocol-drift-check`: Defines the manual process and required evidence to detect MCP protocol drift between official Claude Code releases and current runtime behavior.

### Modified Capabilities
- None.

## Impact

- Affects project operational workflow and documentation for MCP compatibility validation.
- Introduces a formal compatibility decision gate before updating pinned Claude Code assumptions.
- Provides a foundation for future automation without requiring immediate CI or scheduler changes.
