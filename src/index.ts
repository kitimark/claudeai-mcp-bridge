/**
 * claudeai-mcp-bridge
 *
 * A local MCP server that bridges claude.ai connectors (Slack, Atlassian, Gmail,
 * Google Calendar, etc.) into any MCP client (OpenCode, Claude Desktop, Cursor).
 *
 * Uses your existing Claude Code OAuth tokens from macOS Keychain -- no separate
 * credentials needed.
 *
 * Architecture:
 *   Keychain -> OAuth token -> api.anthropic.com/v1/mcp_servers (discovery)
 *   -> mcp-proxy.anthropic.com/v1/mcp/{id} (Streamable HTTP) -> Slack/Atlassian/etc.
 *
 * Usage:
 *   In opencode.json:
 *   {
 *     "mcp": {
 *       "claudeai": {
 *         "type": "local",
 *         "command": ["bun", "run", "/path/to/claudeai-mcp-bridge/src/server.ts"]
 *       }
 *     }
 *   }
 *
 * Entry points:
 *   - src/server.ts     -- MCP stdio server (main entry for OpenCode / any MCP client)
 *   - src/poc-discover.ts -- Standalone discovery script for testing
 */

// Re-export server as the default entry point
export { main as default } from "./server.js";
