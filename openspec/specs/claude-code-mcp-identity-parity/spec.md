### Requirement: Claude Code-style MCP User-Agent
The bridge SHALL generate MCP proxy `User-Agent` values using Claude Code composition semantics.

#### Scenario: Base User-Agent without optional metadata
- **WHEN** `CLAUDE_CODE_UA_VERSION` and optional identity metadata variables are not set
- **THEN** the bridge sends `User-Agent` as `claude-code/<bridge-version>`

#### Scenario: User-Agent version override is injected
- **WHEN** `CLAUDE_CODE_UA_VERSION` is set to a version value such as `2.1.91`
- **THEN** the bridge sends `User-Agent` with `claude-code/2.1.91` while preserving optional suffix metadata composition

#### Scenario: User-Agent with optional metadata suffix
- **WHEN** one or more of `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_AGENT_SDK_VERSION`, or `CLAUDE_AGENT_SDK_CLIENT_APP` are set
- **THEN** the bridge appends a parenthesized suffix with parts in this order: entrypoint, `agent-sdk/<value>`, `client-app/<value>`

### Requirement: Process-scoped MCP Client Session ID
The bridge SHALL generate one MCP client session identifier per process and reuse it across all claude.ai MCP proxy requests in that process.

#### Scenario: Session ID reused across connector requests
- **WHEN** the bridge connects to multiple discovered connectors within one process run
- **THEN** every proxy request uses the same `X-Mcp-Client-Session-Id` value

#### Scenario: Session ID changes across process restarts
- **WHEN** a new bridge process is started after a previous process exits
- **THEN** the new process uses a different `X-Mcp-Client-Session-Id` value

### Requirement: Identity Headers Applied on Proxy Transport Requests
The bridge SHALL include identity headers required for Claude Code parity on all claude.ai MCP proxy HTTP requests.

#### Scenario: Proxy request carries parity headers
- **WHEN** the MCP Streamable HTTP client sends a request to `mcp-proxy.anthropic.com`
- **THEN** the request includes `Authorization`, `User-Agent`, and `X-Mcp-Client-Session-Id` headers

#### Scenario: Post-implementation parity evidence is captured
- **WHEN** implementation is complete and change sign-off is performed
- **THEN** evidence includes a live `poc-discover` run and local mock/curl checks confirming expected `User-Agent` composition and `X-Mcp-Client-Session-Id` lifecycle behavior
