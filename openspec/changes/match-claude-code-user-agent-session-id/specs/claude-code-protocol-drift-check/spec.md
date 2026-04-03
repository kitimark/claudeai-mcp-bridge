## MODIFIED Requirements

### Requirement: Runtime Canary Validation
The project SHALL run a runtime canary against live Anthropic discovery/proxy behavior for the candidate version context before final decision, and SHALL verify MCP identity header parity expectations used by local protocol mocks.

#### Scenario: Runtime canary confirms behavior
- **WHEN** runtime checks execute
- **THEN** the process verifies discovery and MCP proxy interaction outcomes and captures errors when present

#### Scenario: Runtime canary verifies identity header parity evidence
- **WHEN** runtime or local-mock verification is performed for MCP proxy requests
- **THEN** the evidence includes expected `User-Agent` composition and `X-Mcp-Client-Session-Id` lifecycle behavior
