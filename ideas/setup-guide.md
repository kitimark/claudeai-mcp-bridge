# Setup Guide: claudeai-mcp-bridge

Use your claude.ai connectors (Slack, Atlassian, Gmail, Google Calendar) inside any MCP client (OpenCode, Claude Desktop, Cursor, etc.) -- zero credential setup.

---

## 1. Prerequisites

### Claude Code

You need Claude Code installed and logged in with a Pro/Max/Team/Enterprise subscription.

```bash
# Verify Claude Code is installed
claude --version

# If not logged in, run:
claude
# Follow the OAuth login flow in your browser
```

### Connectors Authorized

You must have authorized at least one connector (Slack, Atlassian, etc.) through claude.ai.

1. Visit https://claude.ai/settings/connectors
2. Connect the services you want (Slack, Atlassian, Gmail, Google Calendar)
3. Complete the OAuth flow for each

### Verify Keychain Token

```bash
# Check that Claude Code stored credentials in Keychain (macOS)
security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null | head -c 50
# Should output the start of a JSON blob, not an error
```

### Bun Runtime

```bash
bun -v
# Should output version >= 1.0

# If not installed:
curl -fsSL https://bun.sh/install | bash
```

### OpenCode

```bash
opencode --version
# Should output a version number

# If not installed, see: https://opencode.ai/docs
```

---

## 2. Installation

### From Source

```bash
git clone https://github.com/<your-username>/claudeai-mcp-bridge.git
cd claudeai-mcp-bridge
bun install
```

### From npm (Future)

Once published:

```bash
# No install needed -- bunx runs it directly
# Just configure in opencode.json (see step 4)
```

---

## 3. Verify Credentials

Before wiring into OpenCode, verify everything works standalone.

### Quick Check

```bash
bun run src/poc-discover.ts
```

Expected output:

```
[claudeai-mcp] === claudeai-mcp-bridge POC ===
[claudeai-mcp] Step 1: Reading OAuth token from Keychain...
[claudeai-mcp] Token: sk-ant-oat01...XXXX
[claudeai-mcp] Scopes: user:inference, user:mcp_servers, ...
[claudeai-mcp] Step 2: Discovering claude.ai connectors...
[claudeai-mcp] Found 5 connector(s):
[claudeai-mcp]   - Slack (id: mcpsrv_0...)
[claudeai-mcp]   - Atlassian (id: mcpsrv_0...)
[claudeai-mcp] Step 3: Connecting to connectors and listing tools...
[claudeai-mcp] --- Slack ---
[claudeai-mcp]   Tools (13):
[claudeai-mcp]     - slack_send_message: ...
```

### Verbose Check

```bash
CLAUDEAI_MCP_DEBUG=1 bun run src/poc-discover.ts
```

### Common Failures

| Output | Cause | Fix |
|---|---|---|
| `No OAuth token found` | Claude Code not logged in | Run `claude` and complete login |
| `Token does not have 'user:mcp_servers' scope` | Old token without MCP scope | Log out and re-login: `claude logout && claude` |
| `Token is expired` | Expired OAuth session | Open Claude Code to trigger refresh, then retry |
| `Discovery failed: HTTP 401` | Token revoked or invalid | Re-login to Claude Code |
| `No connectors found` | No services connected | Visit https://claude.ai/settings/connectors |
| `Authentication required` on a connector | OAuth not configured on Anthropic's side for that service | Re-authorize at https://claude.ai/settings/connectors |

---

## 4. OpenCode Configuration

### Project-Level (single project)

Create or edit `opencode.json` in your project root:

```jsonc
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

Replace `/absolute/path/to/` with the actual path where you cloned the repo.

### Global (all projects)

Edit `~/.config/opencode/opencode.json`:

```jsonc
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

### From npm (Future)

```jsonc
{
  "mcp": {
    "claudeai": {
      "type": "local",
      "command": ["bunx", "claudeai-mcp-bridge"]
    }
  }
}
```

### Restart OpenCode

OpenCode loads MCP servers at startup. After changing config:

```bash
# Restart OpenCode (exit and re-run)
opencode
```

---

## 5. Usage Examples

Once configured and restarted, just use natural language:

### Slack

```
> search slack for messages about the deployment from yesterday

> read the #engineering channel for recent messages

> send a message to #general saying "build is green"

> find slack users in the platform team
```

### Jira

```
> what are my open jira issues?

> search jira for bugs assigned to me in project PLATFORM

> create a jira task: "Update API docs for v2 endpoints"

> transition PLAT-123 to "In Review"
```

### Confluence

```
> find the confluence page about onboarding

> get the content of confluence page 12345

> search confluence for "architecture decision records"
```

### Explicit Tool References

You can be explicit about which tools to use:

```
> use claudeai tools to search slack for "release notes"

> use the claudeai_slack_search_public tool to find messages about deployment
```

---

## 6. Managing Tools

### Disable Specific Connectors

If a connector adds too much context, disable it:

```jsonc
// opencode.json
{
  "mcp": {
    "claudeai": {
      "type": "local",
      "command": ["bun", "run", ".../server.ts"]
    }
  },
  "tools": {
    "claudeai_atlassian_*": false
  }
}
```

### Per-Agent Tool Scoping

Enable connectors only for specific agents:

```jsonc
{
  "mcp": {
    "claudeai": {
      "type": "local",
      "command": ["bun", "run", ".../server.ts"]
    }
  },
  "tools": {
    "claudeai_*": false
  },
  "agent": {
    "slack-agent": {
      "tools": {
        "claudeai_slack_*": true
      }
    },
    "jira-agent": {
      "tools": {
        "claudeai_atlassian_*": true
      }
    }
  }
}
```

### Tool Name Patterns

OpenCode names MCP tools as: `{mcp_config_key}_{tool_name}`

With config key `claudeai`, tools appear as:

```
claudeai_slack_send_message
claudeai_slack_search_public
claudeai_slack_search_public_and_private
claudeai_slack_search_channels
claudeai_slack_search_users
claudeai_slack_read_channel
claudeai_slack_read_thread
claudeai_slack_read_canvas
claudeai_slack_read_user_profile
claudeai_slack_send_message_draft
claudeai_slack_schedule_message
claudeai_slack_create_canvas
claudeai_slack_update_canvas
claudeai_atlassian_atlassianUserInfo
claudeai_atlassian_getJiraIssue
claudeai_atlassian_searchJiraIssuesUsingJql
claudeai_atlassian_createJiraIssue
... (44+ total)
```

Use glob patterns to match:

| Pattern | Matches |
|---|---|
| `claudeai_*` | All tools from all connectors |
| `claudeai_slack_*` | All Slack tools |
| `claudeai_atlassian_*` | All Atlassian tools |
| `claudeai_slack_search_*` | Slack search tools only |

---

## 7. Environment Variables

Set these when running the server for customization:

| Variable | Default | Description |
|---|---|---|
| `CLAUDEAI_MCP_DEBUG` | `0` | Set to `1` for verbose debug logging to stderr |
| `CLAUDEAI_MCP_TIMEOUT` | `30000` | Connection timeout per connector in milliseconds |
| `CLAUDEAI_MCP_FILTER` | (none) | Comma-separated connector display names to include (e.g. `Slack,Atlassian`) |
| `CLAUDEAI_MCP_EXCLUDE` | (none) | Comma-separated connector display names to exclude (e.g. `Gmail`) |

### Using environment variables in OpenCode config

```jsonc
{
  "mcp": {
    "claudeai": {
      "type": "local",
      "command": ["bun", "run", ".../server.ts"],
      "environment": {
        "CLAUDEAI_MCP_DEBUG": "1",
        "CLAUDEAI_MCP_EXCLUDE": "Gmail,Google Calendar"
      }
    }
  }
}
```

---

## 8. Claude Code vs OpenCode Comparison

This plugin gives you the same connector tools in OpenCode that Claude Code has natively:

| Feature | Claude Code | OpenCode + this plugin |
|---|---|---|
| Slack search | Built-in | `claudeai_slack_search_*` |
| Slack send messages | Built-in | `claudeai_slack_send_message` |
| Slack read channels | Built-in | `claudeai_slack_read_channel` |
| Jira issues | Built-in | `claudeai_atlassian_*Jira*` |
| Confluence pages | Built-in | `claudeai_atlassian_*Confluence*` |
| Gmail | Built-in | `claudeai_gmail_*` (if authorized) |
| Google Calendar | Built-in | `claudeai_gcal_*` (if authorized) |
| Credential setup | Zero (OAuth via claude.ai) | Zero (reads from Keychain) |
| Tool count (Slack) | 13 | 13 (identical) |
| Tool count (Atlassian) | 31 | 31 (identical) |
| Custom tools alongside | Limited | Full (bash, read, write, glob, grep, etc.) |
| Per-tool enable/disable | No | Yes (glob patterns) |
| Agent-scoped tools | No | Yes |
| Plugin ecosystem | No | Yes (OpenCode plugins) |
| MCP server ecosystem | Limited | Full (any MCP server alongside) |
| IDE integration | VS Code extension | VS Code, Cursor, any editor |

### Same tools, different packaging

The tools are identical because they come from the same upstream MCP servers (Slack's MCP at `mcp.slack.com`, Atlassian's MCP at `mcp.atlassian.com`). This plugin just routes through the same proxy that Claude Code uses (`mcp-proxy.anthropic.com`).

---

## 9. Troubleshooting

### Server won't start

```
# Test the server directly:
bun run src/server.ts

# Check stderr for errors:
CLAUDEAI_MCP_DEBUG=1 bun run src/server.ts 2>debug.log
```

### Token Issues

| Problem | Solution |
|---|---|
| Token expired | Open Claude Code to trigger auto-refresh, then restart OpenCode |
| Missing `user:mcp_servers` scope | Logout and re-login: `claude logout && claude` |
| Keychain access denied | Grant terminal access in System Preferences > Privacy > Security |

### Connector Issues

| Problem | Solution |
|---|---|
| Connector shows "auth required" | Re-authorize at https://claude.ai/settings/connectors |
| Connector not discovered | Check it's connected at https://claude.ai/settings/connectors |
| Tool call returns error | The upstream service may have rate limits or permission issues |

### OpenCode Issues

| Problem | Solution |
|---|---|
| Tools don't appear | Restart OpenCode after config change |
| Too many tools in context | Use `tools` config to disable unused connectors |
| Timeout on startup | Increase timeout: `"environment": { "CLAUDEAI_MCP_TIMEOUT": "60000" }` |
| MCP shows "failed" status | Run `opencode mcp list` to check, then check server stderr |

### Linux / Windows

macOS uses Keychain for credential storage. On other platforms:

- **Linux**: Credentials fallback to `~/.claude/.credentials.json`
- **Windows**: Credentials fallback to `~/.claude/.credentials.json` (or Windows Credential Manager in future)

---

## 10. Caveats and Disclaimers

### Undocumented API

This plugin uses internal Anthropic endpoints:
- `api.anthropic.com/v1/mcp_servers` (connector discovery)
- `mcp-proxy.anthropic.com/v1/mcp/{server_id}` (MCP proxy)

These are not publicly documented and may change without notice.

### Terms of Service

Using Claude subscription OAuth tokens outside official clients (Claude Code, claude.ai) may violate Anthropic's Terms of Service. Use at your own discretion. The same disclaimer applies to [opencode-claude-auth](https://github.com/griffinmartin/opencode-claude-auth).

### Token Refresh

This plugin reads tokens from macOS Keychain but does not refresh them independently. It relies on Claude Code to keep tokens fresh. If your token expires:

1. Open Claude Code (run `claude` in any terminal)
2. Claude Code auto-refreshes the token in Keychain
3. Restart OpenCode to pick up the new token

### Connector Availability

Not all connectors may work. From our testing:
- **Slack**: Works reliably
- **Atlassian**: Works reliably (if recently authorized)
- **Gmail**: May require re-authorization
- **Google Calendar**: May require re-authorization

Connectors that show "MCP server requires authentication but no OAuth token is configured" need to be re-authorized at https://claude.ai/settings/connectors.
