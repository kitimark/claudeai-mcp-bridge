#!/usr/bin/env bun
/**
 * claudeai-mcp-bridge MCP Server
 *
 * A local MCP server (stdio) that bridges claude.ai connectors into any MCP client.
 * Reads OAuth tokens from macOS Keychain, discovers connectors, and proxies
 * tool calls through mcp-proxy.anthropic.com.
 *
 * Usage in opencode.json:
 *   { "mcp": { "claudeai": { "type": "local", "command": ["bun", "run", ".../server.ts"] } } }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool as MCPTool,
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

// ─── Config ───────────────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com";
const MCP_PROXY_URL = "https://mcp-proxy.anthropic.com";
const MCP_PROXY_PATH = "/v1/mcp/{server_id}";
const BETA_HEADER = "mcp-servers-2025-12-04";
const API_VERSION = "2023-06-01";

const DEBUG = process.env.CLAUDEAI_MCP_DEBUG === "1";
const TIMEOUT = parseInt(process.env.CLAUDEAI_MCP_TIMEOUT || "30000", 10);
const FILTER = process.env.CLAUDEAI_MCP_FILTER?.split(",").map((s) => s.trim().toLowerCase()) || null;
const EXCLUDE = process.env.CLAUDEAI_MCP_EXCLUDE?.split(",").map((s) => s.trim().toLowerCase()) || null;

// ─── Logger (stderr only -- stdout is for MCP protocol) ──────────

function log(msg: string) {
  process.stderr.write(`[claudeai-mcp] ${msg}\n`);
}

function debug(msg: string) {
  if (DEBUG) process.stderr.write(`[claudeai-mcp:debug] ${msg}\n`);
}

// ─── Keychain ─────────────────────────────────────────────────────

interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
}

function readKeychainTokens(): OAuthTokens | null {
  if (process.platform === "darwin") {
    try {
      const raw = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
        { encoding: "utf-8" },
      ).trim();
      const data = JSON.parse(raw);
      const oauth = data.claudeAiOauth || data;
      if (oauth.accessToken) {
        debug(`Token from Keychain, expires: ${new Date(oauth.expiresAt).toISOString()}`);
        return oauth;
      }
    } catch (e) {
      debug(`Keychain read failed: ${e}`);
    }
  }

  const credPaths = [
    join(process.env.HOME || "~", ".claude", ".credentials.json"),
    join(process.env.HOME || "~", ".claude", "credentials.json"),
  ];
  for (const p of credPaths) {
    if (existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, "utf-8"));
        const oauth = data.claudeAiOauth || data;
        if (oauth.accessToken) {
          debug(`Token from ${p}`);
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

interface McpServerInfo {
  type: string;
  id: string;
  display_name: string;
  url: string;
  created_at: string;
}

async function discoverConnectors(accessToken: string): Promise<McpServerInfo[]> {
  const url = `${ANTHROPIC_API_URL}/v1/mcp_servers?limit=1000`;
  debug(`Discovering connectors: ${url}`);

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
    throw new Error(`Discovery failed: HTTP ${response.status} - ${body}`);
  }

  const result = (await response.json()) as { data: McpServerInfo[] };
  let connectors = result.data || [];

  // Apply filter/exclude
  if (FILTER) {
    connectors = connectors.filter((c) => FILTER.includes(c.display_name.toLowerCase()));
  }
  if (EXCLUDE) {
    connectors = connectors.filter((c) => !EXCLUDE.includes(c.display_name.toLowerCase()));
  }

  return connectors;
}

// ─── Proxy Client Management ──────────────────────────────────────

interface ConnectorClient {
  name: string;
  prefix: string;
  client: Client;
  tools: MCPTool[];
}

const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

async function connectToProxy(
  server: McpServerInfo,
  accessToken: string,
): Promise<ConnectorClient | null> {
  const proxyUrl = `${MCP_PROXY_URL}${MCP_PROXY_PATH.replace("{server_id}", server.id)}`;
  const sessionId = randomUUID();
  const prefix = sanitize(server.display_name);

  debug(`Connecting ${server.display_name} via ${proxyUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(proxyUrl), {
    fetch: async (url, init) => {
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${accessToken}`);
      headers.set("X-Mcp-Client-Session-Id", sessionId);
      return fetch(url, { ...init, headers });
    },
    requestInit: {
      headers: { "User-Agent": "claudeai-mcp-bridge/0.1.0" },
    },
  });

  const client = new Client(
    { name: "claudeai-mcp-bridge", version: "0.1.0" },
    { capabilities: {} },
  );

  try {
    await Promise.race([
      client.connect(transport),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), TIMEOUT),
      ),
    ]);

    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];

    log(`Connected: ${server.display_name} (${tools.length} tools)`);
    return { name: server.display_name, prefix, client, tools };
  } catch (e) {
    log(`Failed: ${server.display_name} - ${e}`);
    try { await client.close(); } catch {}
    return null;
  }
}

// ─── Main Server ──────────────────────────────────────────────────

async function main() {
  log("Starting server...");

  // Step 1: Read credentials
  const tokens = readKeychainTokens();
  if (!tokens) {
    log("ERROR: No OAuth token found. Is Claude Code logged in?");
    process.exit(1);
  }

  if (tokens.expiresAt < Date.now()) {
    log("WARNING: Token may be expired. Open Claude Code to refresh.");
  }

  // Step 2: Discover connectors
  let connectors: McpServerInfo[];
  try {
    connectors = await discoverConnectors(tokens.accessToken);
  } catch (e) {
    log(`ERROR: Discovery failed: ${e}`);
    process.exit(1);
  }

  log(`Discovered ${connectors.length} connector(s)`);

  // Step 3: Connect to each connector in parallel
  const results = await Promise.allSettled(
    connectors.map((c) => connectToProxy(c, tokens.accessToken)),
  );

  const clients: ConnectorClient[] = results
    .filter((r): r is PromiseFulfilledResult<ConnectorClient | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((c): c is ConnectorClient => c !== null);

  if (clients.length === 0) {
    log("WARNING: No connectors connected. Server will have no tools.");
  }

  // Build tool lookup: prefixed_name -> { connectorClient, originalToolName }
  const toolMap = new Map<string, { connector: ConnectorClient; originalName: string }>();
  for (const connector of clients) {
    for (const tool of connector.tools) {
      const prefixedName = `${connector.prefix}_${tool.name}`;
      toolMap.set(prefixedName, { connector, originalName: tool.name });
    }
  }

  log(`Serving ${toolMap.size} tools from ${clients.length} connector(s)`);

  // Step 4: Create MCP server
  const server = new Server(
    { name: "claudeai-mcp-bridge", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  // Handle tools/list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: MCPTool[] = [];

    for (const connector of clients) {
      for (const tool of connector.tools) {
        tools.push({
          name: `${connector.prefix}_${tool.name}`,
          description: `[${connector.name}] ${tool.description || ""}`,
          inputSchema: tool.inputSchema,
        });
      }
    }

    debug(`tools/list returning ${tools.length} tools`);
    return { tools };
  });

  // Handle tools/call
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const entry = toolMap.get(name);
    if (!entry) {
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    debug(`tools/call: ${name} -> ${entry.connector.name}.${entry.originalName}`);

    try {
      const result = await entry.connector.client.callTool(
        {
          name: entry.originalName,
          arguments: (args || {}) as Record<string, unknown>,
        },
        CallToolResultSchema,
      );

      return {
        content: result.content as Array<{ type: "text"; text: string }>,
        isError: result.isError || false,
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      log(`Tool call error: ${name} - ${errorMsg}`);
      return {
        content: [{ type: "text" as const, text: `Error calling ${name}: ${errorMsg}` }],
        isError: true,
      };
    }
  });

  // Step 5: Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log("Server ready (stdio)");

  // Cleanup on exit
  process.on("SIGINT", async () => {
    debug("Shutting down...");
    for (const c of clients) {
      try { await c.client.close(); } catch {}
    }
    await server.close();
    process.exit(0);
  });
}

main().catch((e) => {
  process.stderr.write(`[claudeai-mcp] Fatal: ${e}\n`);
  process.exit(1);
});
