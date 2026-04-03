# claudeai-mcp-bridge: How It Works

## Overview

An MCP server that bridges `claude.ai` connectors (Slack, Atlassian, Gmail, Google Calendar, etc.) into any MCP-compatible client (OpenCode, Claude Desktop, Cursor, etc.). No separate credentials needed -- uses your existing Claude Code OAuth tokens from macOS Keychain.

## The Core Insight

Claude Code's `claude.ai Slack` connector isn't magic -- it's a standard MCP server that Anthropic hosts behind a proxy. Your OAuth token (stored in macOS Keychain) is the key to access it. The proxy at `mcp-proxy.anthropic.com` authenticates you and forwards requests to the actual Slack/Atlassian/Gmail MCP servers, where Anthropic holds the OAuth tokens you authorized through Claude.ai.

---

## Research Findings

### Source Code Analysis

Discovered from [Claude Code decompiled source](https://github.com/yasasbanukaofficial/claude-code):

| Source File | What It Reveals |
|---|---|
| `src/services/mcp/claudeai.ts` | Discovery endpoint, server config type `claudeai-proxy`, beta header |
| `src/constants/oauth.ts` | MCP proxy URL (`mcp-proxy.anthropic.com`), proxy path pattern, OAuth scopes |
| `src/services/mcp/client.ts` | How `claudeai-proxy` transport is created, `createClaudeAiProxyFetch` with 401 retry |
| `src/services/mcp/auth.ts` | Full OAuth flow, keychain storage format, token refresh |
| `src/services/api/grove.ts` | "Grove" = Anthropic's internal name for the connector system |

### Key Protocol Details

| Component | Value |
|---|---|
| **Discovery endpoint** | `GET https://api.anthropic.com/v1/mcp_servers?limit=1000` |
| **Beta header** | `anthropic-beta: mcp-servers-2025-12-04` |
| **API version header** | `anthropic-version: 2023-06-01` |
| **Required OAuth scope** | `user:mcp_servers` |
| **MCP Proxy URL** | `https://mcp-proxy.anthropic.com` |
| **MCP Proxy path** | `/v1/mcp/{server_id}` |
| **Transport type** | `claudeai-proxy` (internally) = MCP Streamable HTTP |
| **Auth mechanism** | `Authorization: Bearer <OAuth-access-token>` with auto-retry on 401 |
| **Session header** | `X-Mcp-Client-Session-Id: <uuid>` |
| **Keychain service** | `Claude Code-credentials` |

### Reference Plugin

[opencode-claude-auth](https://github.com/griffinmartin/opencode-claude-auth) -- an existing OpenCode plugin that reads Claude Code OAuth tokens from Keychain for API auth. Our plugin uses the same credential reading approach but for a different purpose (MCP connector access instead of API inference).

---

## Step-by-Step: What the Plugin Does

### Step 1: Read OAuth Token from macOS Keychain

When you first authenticated Claude Code (`claude` CLI), it stored your OAuth credentials in the macOS Keychain under the service name `Claude Code-credentials`.

```
macOS Keychain
  └── "Claude Code-credentials"
       └── JSON blob:
            {
              "claudeAiOauth": {
                "accessToken": "sk-ant-oat-...",
                "refreshToken": "sk-ant-ort-...",
                "expiresAt": 1775250077857,
                "scopes": ["user:inference", "user:mcp_servers", ...]
              }
            }
```

The plugin reads this by running:

```bash
security find-generic-password -s "Claude Code-credentials" -w
```

The key scope is **`user:mcp_servers`** -- without it, the API rejects the request.

On Linux/Windows, the fallback is `~/.claude/.credentials.json` (same JSON structure, just a file instead of Keychain).

### Step 2: Discover Available Connectors

With the token in hand, the plugin calls Anthropic's connector discovery API:

```
GET https://api.anthropic.com/v1/mcp_servers?limit=1000

Headers:
  Authorization: Bearer sk-ant-oat-...
  anthropic-beta: mcp-servers-2025-12-04
  anthropic-version: 2023-06-01
```

Response (example):

```json
{
  "data": [
    {
      "type": "mcp_server",
      "id": "a1b2c3d4-...",
      "display_name": "Slack",
      "url": "https://mcp.slack.com/...",
      "created_at": "2025-06-15T..."
    },
    {
      "type": "mcp_server",
      "id": "e5f6g7h8-...",
      "display_name": "Atlassian",
      "url": "https://mcp.atlassian.com/...",
      "created_at": "2025-07-20T..."
    }
  ]
}
```

This tells us: "You have Slack and Atlassian connected. Here are their server IDs."

### Step 3: Connect to Each Connector via the MCP Proxy

We do NOT connect directly to `mcp.slack.com`. Instead, we go through Anthropic's proxy which holds your Slack OAuth tokens.

For each discovered connector, we create an MCP client:

```
URL: https://mcp-proxy.anthropic.com/v1/mcp/a1b2c3d4-...
                                            └── server_id for Slack

Protocol: MCP Streamable HTTP
Headers:
  Authorization: Bearer sk-ant-oat-...  (your Anthropic OAuth token)
  X-Mcp-Client-Session-Id: <random-uuid>
```

The flow through the proxy:

```
Plugin                    Anthropic Proxy                 Slack API
  │                            │                              │
  │  MCP initialize            │                              │
  │  (Bearer: your-token)      │                              │
  │───────────────────────────>│                              │
  │                            │  Validates your token        │
  │                            │  Looks up: "this user        │
  │                            │  authorized Slack on         │
  │                            │  2025-06-15"                 │
  │                            │                              │
  │                            │  Uses STORED Slack OAuth     │
  │                            │  token to call Slack API     │
  │                            │────────────────────────────->│
  │                            │                              │
  │                            │<── Slack response ───────────│
  │<── MCP response ──────────│                              │
```

### Step 4: List Tools from Each Connector

Once connected, we call `client.listTools()` on each MCP client. This returns the available tools, for example:

**Slack connector tools:**
- `slack_list_channels` -- List Slack channels
- `slack_search_messages` -- Search messages
- `slack_post_message` -- Post a message
- `slack_get_thread` -- Get thread replies

**Atlassian connector tools:**
- `atlassian_search_issues` -- Search Jira issues
- `atlassian_get_page` -- Get Confluence page

### Step 5: Register as Custom Tools in OpenCode

For each discovered tool, the plugin registers it as an OpenCode custom tool using the plugin API:

```ts
// Pseudocode
return {
  tool: {
    claudeai_slack_search_messages: tool({
      description: "Search Slack messages",
      args: { query: tool.schema.string() },
      async execute(args) {
        const result = await slackMcpClient.callTool({
          name: "slack_search_messages",
          arguments: args,
        })
        return result
      },
    }),
  },
}
```

OpenCode now sees these tools alongside its built-in tools (read, write, bash, etc.).

### Step 6: User Makes a Request

```
You: "Search Slack for messages about the deployment issue yesterday"

OpenCode LLM
  │
  │ tool_use: claudeai_slack_search_messages
  │   args: { query: "deployment issue", ... }
  │
  ▼
Plugin execute()
  │
  │ slackMcpClient.callTool("slack_search_messages", {...})
  │
  ▼
MCP Streamable HTTP request
  │
  │ POST https://mcp-proxy.anthropic.com/v1/mcp/a1b2c3d4-...
  │ Authorization: Bearer sk-ant-oat-...
  │ Body: { method: "tools/call", params: { name: "...", arguments: {...} } }
  │
  ▼
Anthropic Proxy -> Slack API -> Returns messages
  │
  ▼
Result displayed in OpenCode
```

---

## Token Lifecycle

```
                    Token valid?
                    │
              ┌─────┴─────┐
              │ Yes        │ No (within 60s of expiry)
              │            │
              ▼            ▼
         Use cached    Refresh token
         token         │
                       ├── Try 1: POST https://claude.ai/v1/oauth/token
                       │          (grant_type=refresh_token)
                       │
                       ├── Try 2: Re-read from Keychain
                       │          (Claude Code may have refreshed it)
                       │
                       └── Fail: Log error, tools become unavailable
```

---

## Full Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         YOUR MAC                                   │
│                                                                    │
│  ┌──────────┐     ┌──────────────────────────────────────────┐    │
│  │ macOS    │     │  OpenCode                                │    │
│  │ Keychain │     │                                          │    │
│  │          │     │  ┌────────────────────────────────────┐  │    │
│  │ "Claude  │<────│──│  claudeai-mcp-bridge plugin      │  │    │
│  │  Code-   │read │  │                                    │  │    │
│  │  creds"  │token│  │  1. Reads token from Keychain      │  │    │
│  └──────────┘     │  │  2. Discovers connectors via API   │  │    │
│                   │  │  3. Creates MCP clients             │  │    │
│                   │  │  4. Registers tools in OpenCode     │  │    │
│                   │  │  5. Proxies tool calls              │  │    │
│                   │  └──────┬─────────────────────────────┘  │    │
│                   │         │                                │    │
│                   └─────────┼────────────────────────────────┘    │
│                             │                                      │
└─────────────────────────────┼──────────────────────────────────────┘
                              │ HTTPS
                              │
┌─────────────────────────────┼──────────────────────────────────────┐
│                    ANTHROPIC INFRASTRUCTURE                         │
│                             │                                      │
│  ┌──────────────────────────▼───────────────────────────────────┐  │
│  │  api.anthropic.com/v1/mcp_servers                            │  │
│  │  -> Returns list of your connected services                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  mcp-proxy.anthropic.com/v1/mcp/{server_id}                 │  │
│  │                                                              │  │
│  │  ┌─────────┐   Your Anthropic   ┌──────────────────────┐   │  │
│  │  │ Validates│   OAuth token      │ Stored service OAuth │   │  │
│  │  │ identity │────────────────>   │ tokens (Slack, etc.) │   │  │
│  │  └─────────┘                     └──────────┬───────────┘   │  │
│  │                                              │              │  │
│  └──────────────────────────────────────────────┼──────────────┘  │
│                                                 │                  │
└─────────────────────────────────────────────────┼──────────────────┘
                                                  │ HTTPS
                              ┌───────────────────┼───────────────┐
                              │                   │               │
                              ▼                   ▼               ▼
                        ┌──────────┐      ┌────────────┐  ┌──────────┐
                        │ Slack API│      │Atlassian API│  │Gmail API │
                        └──────────┘      └────────────┘  └──────────┘
```

---

## Alternative Approaches Considered

### Approach 1: MCP Config Sync (standard mcpServers only)

Read `~/.claude.json` -> `mcpServers` and translate to OpenCode format. Only covers self-configured MCP servers (MongoDB, ClickHouse, Figma), NOT `claude.ai` connectors.

**Verdict:** Useful but doesn't solve the connector problem.

### Approach 2: Direct MCP Proxy Connection (chosen)

Discover connectors via API, connect to `mcp-proxy.anthropic.com` with OAuth token.

**Verdict:** Clean, fast, uses documented MCP SDK. The proxy URL and discovery API are undocumented/internal but stable.

### Approach 3: Claude CLI as Bridge

Shell out to `claude -p "use Slack to..."` for each tool call.

**Verdict:** Works but slow (~3-5s per call), consumes Claude tokens, fragile parsing.

---

## Risks and Caveats

1. **Terms of Service** -- Using Claude subscription tokens outside official clients may violate Anthropic's ToS. Same disclaimer as `opencode-claude-auth`.
2. **Undocumented API** -- `/v1/mcp_servers` and `mcp-proxy.anthropic.com` are internal endpoints. They could change without notice.
3. **Token refresh** -- Need to handle token expiry. Can re-read from Keychain (Claude Code refreshes it) or do direct OAuth refresh.
4. **macOS only (Keychain)** -- Linux/Windows needs the file-based credentials fallback path.

---

## POC Plan

### Goal

Prove that we can:
1. Read OAuth token from macOS Keychain
2. Discover `claude.ai` connectors via the API
3. Connect to `mcp-proxy.anthropic.com` and list tools from a connector
4. Execute a tool call through the proxy and get a real result

### Success Criteria

- OpenCode shows discovered connector tools in the tool list
- A real Slack (or Atlassian) query returns actual data
- No separate Slack/Atlassian credentials needed

### Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **MCP SDK:** `@modelcontextprotocol/sdk` (Streamable HTTP transport)
- **Plugin API:** `@opencode-ai/plugin`

### Estimated Size

~200-250 lines for POC (single `src/index.ts`).
