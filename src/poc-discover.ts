/**
 * POC: Standalone discovery script
 *
 * Run with: bun run src/poc-discover.ts
 *
 * This script:
 * 1. Reads OAuth token from macOS Keychain
 * 2. Discovers claude.ai connectors via the API
 * 3. Connects to each connector via mcp-proxy.anthropic.com
 * 4. Lists available tools from each connector
 *
 * No OpenCode plugin wiring -- just proves the protocol works.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  getMcpClientSessionId,
  getMcpUserAgent,
  withClaudeAiProxyHeaders,
} from "./mcp-identity.js";

// ─── Config ───────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com";
const MCP_PROXY_URL = "https://mcp-proxy.anthropic.com";
const MCP_PROXY_PATH = "/v1/mcp/{server_id}";
const BETA_HEADER = "mcp-servers-2025-12-04";
const API_VERSION = "2023-06-01";
const DEBUG = process.env.CLAUDEAI_MCP_DEBUG === "1";

// ─── Logger ───────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[claudeai-mcp] ${msg}`);
}

function debug(msg: string) {
  if (DEBUG) console.log(`[claudeai-mcp:debug] ${msg}`);
}

function redactToken(token: string): string {
  if (token.length <= 20) return "***";
  return token.slice(0, 12) + "..." + token.slice(-4);
}

// ─── Keychain ─────────────────────────────────────────────────────

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

function readKeychainTokens(): OAuthTokens | null {
  // Try macOS Keychain first
  if (process.platform === "darwin") {
    try {
      const raw = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: "utf-8" }
      ).trim();
      const data = JSON.parse(raw);
      const oauth = data.claudeAiOauth || data;
      if (oauth.accessToken) {
        debug(`Read token from Keychain: ${redactToken(oauth.accessToken)}`);
        debug(`Scopes: ${(oauth.scopes || []).join(", ")}`);
        debug(
          `Expires: ${new Date(oauth.expiresAt).toISOString()} (${oauth.expiresAt > Date.now() ? "valid" : "EXPIRED"})`
        );
        return oauth;
      }
    } catch (e) {
      debug(`Keychain read failed: ${e}`);
    }
  }

  // Fallback: credentials file
  const credPaths = [
    join(
      process.env.HOME || "~",
      ".claude",
      ".credentials.json"
    ),
    join(
      process.env.HOME || "~",
      ".claude",
      "credentials.json"
    ),
  ];

  for (const p of credPaths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, "utf-8"));
        const oauth = data.claudeAiOauth || data;
        if (oauth.accessToken) {
          debug(`Read token from ${p}`);
          return oauth;
        }
      } catch (e) {
        debug(`Failed to read ${p}: ${e}`);
      }
    }
  }

  return null;
}

// ─── Discovery ────────────────────────────────────────────────────

interface McpServer {
  type: string;
  id: string;
  display_name: string;
  url: string;
  created_at: string;
}

interface DiscoveryResponse {
  data: McpServer[];
}

async function discoverConnectors(
  accessToken: string
): Promise<McpServer[]> {
  const url = `${ANTHROPIC_API_URL}/v1/mcp_servers?limit=1000`;
  debug(`Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "anthropic-beta": BETA_HEADER,
      "anthropic-version": API_VERSION,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Discovery failed: HTTP ${response.status} - ${body}`
    );
  }

  const result = (await response.json()) as DiscoveryResponse;
  return result.data || [];
}

// ─── MCP Proxy Connection ─────────────────────────────────────────

async function connectToProxy(
  serverId: string,
  serverName: string,
  accessToken: string
): Promise<Client | null> {
  const proxyUrl = `${MCP_PROXY_URL}${MCP_PROXY_PATH.replace("{server_id}", serverId)}`;
  log(`Connecting to proxy: ${proxyUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(proxyUrl), {
    fetch: async (url, init) => {
      const headers = withClaudeAiProxyHeaders(init?.headers, accessToken);
      return fetch(url, { ...init, headers });
    },
    requestInit: {
      headers: {
        "User-Agent": getMcpUserAgent(),
        "X-Mcp-Client-Session-Id": getMcpClientSessionId(),
      },
    },
  });

  const client = new Client(
    {
      name: "claudeai-mcp-bridge",
      version: "0.1.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    log(`Connected to ${serverName}`);
    return client;
  } catch (e) {
    log(`Failed to connect to ${serverName}: ${e}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  log("=== claudeai-mcp-bridge POC ===\n");

  // Step 1: Read credentials
  log("Step 1: Reading OAuth token from Keychain...");
  const tokens = readKeychainTokens();
  if (!tokens) {
    log("ERROR: No OAuth token found. Is Claude Code logged in?");
    process.exit(1);
  }

  if (!tokens.scopes?.includes("user:mcp_servers")) {
    log(
      "WARNING: Token does not have 'user:mcp_servers' scope. Discovery may fail."
    );
    log(`Available scopes: ${tokens.scopes?.join(", ")}`);
  }

  if (tokens.expiresAt < Date.now()) {
    log("WARNING: Token is expired. You may need to refresh Claude Code.");
  }

  log(`Token: ${redactToken(tokens.accessToken)}`);
  log(`Expires: ${new Date(tokens.expiresAt).toISOString()}`);
  log(`Scopes: ${tokens.scopes?.join(", ")}\n`);

  // Step 2: Discover connectors
  log("Step 2: Discovering claude.ai connectors...");
  let connectors: McpServer[];
  try {
    connectors = await discoverConnectors(tokens.accessToken);
  } catch (e) {
    log(`ERROR: Discovery failed: ${e}`);
    process.exit(1);
  }

  if (connectors.length === 0) {
    log("No connectors found. Connect services at https://claude.ai/settings/connectors");
    process.exit(0);
  }

  log(`Found ${connectors.length} connector(s):\n`);
  for (const c of connectors) {
    log(`  - ${c.display_name} (id: ${c.id.slice(0, 8)}...)`);
    debug(`    url: ${c.url}`);
    debug(`    created: ${c.created_at}`);
  }
  log("");

  // Step 3: Connect to each and list tools
  log("Step 3: Connecting to connectors and listing tools...\n");

  for (const connector of connectors) {
    log(`--- ${connector.display_name} ---`);

    const client = await connectToProxy(
      connector.id,
      connector.display_name,
      tokens.accessToken
    );

    if (!client) {
      log(`  Skipping (connection failed)\n`);
      continue;
    }

    try {
      const toolsResult = await client.listTools();
      const tools = toolsResult.tools || [];

      log(`  Tools (${tools.length}):`);
      for (const tool of tools) {
        log(`    - ${tool.name}: ${(tool.description || "").slice(0, 80)}`);
      }

      if (tools.length === 0) {
        log(`  (no tools exposed)`);
      }
    } catch (e) {
      log(`  Failed to list tools: ${e}`);
    }

    try {
      await client.close();
    } catch {
      // ignore close errors
    }

    log("");
  }

  log("=== POC Complete ===");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
