# claudeai-mcp-bridge

> **Disclaimer:** This project is **not affiliated with, endorsed by, or officially supported by Anthropic**. It is an independent, experimental project for educational and research purposes. It uses undocumented internal APIs that may change or break at any time. Using Claude subscription tokens outside official clients may violate Anthropic's [Terms of Service](https://www.anthropic.com/terms). **Use at your own risk** -- no warranty is provided.

Use your **claude.ai connectors** (Slack, Atlassian, Gmail, Google Calendar) inside any MCP client -- zero credential setup.

This is a standard MCP server (stdio) that bridges connectors you've already authorized through [claude.ai](https://claude.ai/settings/connectors) into any MCP-compatible tool. Works with **OpenCode**, **Claude Desktop**, **Cursor**, **Cline**, **Windsurf**, and more.

## How it works

```
┌────────────┐  stdio (MCP)  ┌──────────────────┐   HTTPS    ┌──────────────────┐
│ Any MCP    │──────────────>│ This MCP Server  │──────────>│ mcp-proxy.       │
│ Client     │<──────────────│                  │<──────────│ anthropic.com    │
│            │  tools/list   │ Reads Keychain   │           │                  │
│ OpenCode   │  tools/call   │ Discovers servers│           │ Slack, Atlassian │
│ Claude     │               │ Proxies calls    │           │ Gmail, Calendar  │
│ Desktop    │               └──────────────────┘           └──────────────────┘
│ Cursor     │
│ ...        │
└────────────┘
```

1. Reads your OAuth token from macOS Keychain (written by Claude Code)
2. Discovers your connectors via `api.anthropic.com/v1/mcp_servers`
3. Connects to each via `mcp-proxy.anthropic.com` (Streamable HTTP)
4. Exposes all tools over stdio MCP protocol

## Prerequisites

- **Claude Code** logged in (`claude --version`)
- **Connectors authorized** at https://claude.ai/settings/connectors
- **Bun** runtime (`bun -v`)

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/kitimark/claudeai-mcp-bridge.git
cd claudeai-mcp-bridge
bun install
```

### 2. Verify it works

```bash
bun run src/poc-discover.ts
```

You should see your connectors and their tools listed:

```
[claudeai-mcp] Found 5 connector(s):
[claudeai-mcp]   - Slack (id: mcpsrv_0...)
[claudeai-mcp]   - Atlassian (id: mcpsrv_0...)
[claudeai-mcp] --- Slack ---
[claudeai-mcp]   Tools (13):
[claudeai-mcp]     - slack_send_message: Sends a message to a Slack channel...
```

For TypeScript validation in this repo, use project-mode checks:

```bash
bun run typecheck
```

### 3. Add to your MCP client

#### OpenCode

```jsonc
// opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "claudeai": {
      "type": "local",
      "command": ["bun", "run", "/absolute/path/to/claudeai-mcp-bridge/src/server.ts"]
    }
  }
}
```

#### Claude Desktop

```jsonc
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "claudeai": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/claudeai-mcp-bridge/src/server.ts"]
    }
  }
}
```

#### Cursor

```jsonc
// .cursor/mcp.json
{
  "mcpServers": {
    "claudeai": {
      "command": "bun",
      "args": ["run", "/absolute/path/to/claudeai-mcp-bridge/src/server.ts"],
      "env": {
        "CLAUDEAI_MCP_EXCLUDE": "Gmail,Google Calendar"
      }
    }
  }
}
```

### 4. Use it

```
> search slack for messages about the deployment from yesterday

> what are my open jira issues?

> find the confluence page about onboarding
```

## Available tools

Once connected, you get the same tools as Claude Code:

| Connector | Tools | Examples |
|-----------|-------|---------|
| **Slack** | 13 | search messages, send messages, read channels, read threads, manage canvases |
| **Atlassian** | 31 | Jira issues (CRUD, transitions, search), Confluence pages (CRUD, search, comments) |
| **Gmail** | varies | read/send email (requires active auth) |
| **Google Calendar** | varies | manage events (requires active auth) |

Tool names follow the pattern: `{connector}_{tool_name}`

Examples: `slack_search_public`, `atlassian_getJiraIssue`

(Your MCP client may add its own prefix, e.g. OpenCode: `claudeai_slack_search_public`)

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLAUDEAI_MCP_DEBUG` | `0` | Set to `1` for verbose logging |
| `CLAUDEAI_MCP_TIMEOUT` | `30000` | Connection timeout per connector (ms) |
| `CLAUDEAI_MCP_FILTER` | (all) | Comma-separated connector names to include |
| `CLAUDEAI_MCP_EXCLUDE` | (none) | Comma-separated connector names to exclude |
| `CLAUDE_CODE_UA_VERSION` | package version | Override `User-Agent` Claude Code version for protocol parity simulation |

### Managing tools (OpenCode)

Disable specific connectors:

```jsonc
{ "tools": { "claudeai_atlassian_*": false } }
```

Enable only for specific agents:

```jsonc
{
  "tools": { "claudeai_*": false },
  "agent": {
    "slack-agent": { "tools": { "claudeai_slack_*": true } }
  }
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `No OAuth token found` | Run `claude` to log in |
| `Token expired` | Open Claude Code to auto-refresh |
| Connector shows "auth required" | Re-authorize at https://claude.ai/settings/connectors |
| Tools don't appear | Restart your MCP client after config change |
| Too many tools | Use `CLAUDEAI_MCP_EXCLUDE` env var |
| VS Code/Zed shows errors but `bun run typecheck` passes | Reopen the repository root (not a single loose file), run `bun install`, restart the TypeScript server in your editor, and ensure the editor uses workspace TypeScript from `node_modules/typescript/lib` |

## Compatibility

| MCP Client | Supported | Config location |
|------------|-----------|-----------------|
| **OpenCode** | Yes | `opencode.json` |
| **Claude Desktop** | Yes | `claude_desktop_config.json` |
| **Cursor** | Yes | `.cursor/mcp.json` |
| **Cline** | Yes | `.cline/mcp_settings.json` |
| **Windsurf** | Yes | MCP settings |
| **Continue.dev** | Yes | `config.json` |
| **Zed** | Yes | `settings.json` |
| **Any stdio MCP client** | Yes | -- |

## How it compares to Claude Code

| | Claude Code | Any client + this bridge |
|---|---|---|
| Same Slack/Atlassian tools | Yes | Yes (identical, same upstream servers) |
| Credential setup | Zero | Zero (reads from Keychain) |
| Custom tools alongside | Limited | Whatever your client supports |
| Works with any editor/tool | No | Yes |

## Docs

- [ideas/how-it-works.md](ideas/how-it-works.md) -- Full protocol research, architecture diagrams, source code analysis
- [ideas/setup-guide.md](ideas/setup-guide.md) -- Detailed setup guide with troubleshooting

## Caveats

- Uses **undocumented Anthropic endpoints** (`/v1/mcp_servers`, `mcp-proxy.anthropic.com`) that may change
- Using Claude subscription tokens outside official clients may violate **Anthropic's ToS**
- Token refresh depends on Claude Code -- keep it installed
- macOS Keychain primary; Linux/Windows falls back to `~/.claude/.credentials.json`

## License

MIT
