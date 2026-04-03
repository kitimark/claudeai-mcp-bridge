import { randomUUID } from "crypto";
import packageJson from "../package.json";

const MCP_CLIENT_SESSION_ID = randomUUID();
const DEFAULT_CLAUDE_CODE_UA_VERSION = packageJson.version;

export function getMcpClientSessionId(): string {
  return MCP_CLIENT_SESSION_ID;
}

export function getMcpUserAgent(env: NodeJS.ProcessEnv = process.env): string {
  const version = getMcpUserAgentVersion(env);
  const parts: string[] = [];

  if (env.CLAUDE_CODE_ENTRYPOINT) {
    parts.push(env.CLAUDE_CODE_ENTRYPOINT);
  }
  if (env.CLAUDE_AGENT_SDK_VERSION) {
    parts.push(`agent-sdk/${env.CLAUDE_AGENT_SDK_VERSION}`);
  }
  if (env.CLAUDE_AGENT_SDK_CLIENT_APP) {
    parts.push(`client-app/${env.CLAUDE_AGENT_SDK_CLIENT_APP}`);
  }

  const suffix = parts.length > 0 ? ` (${parts.join(", ")})` : "";
  return `claude-code/${version}${suffix}`;
}

export function getMcpUserAgentVersion(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CLAUDE_CODE_UA_VERSION?.trim();
  if (override) {
    return override;
  }
  return DEFAULT_CLAUDE_CODE_UA_VERSION;
}

export function withClaudeAiProxyHeaders(
  initHeaders: RequestInit["headers"],
  accessToken: string,
  env: NodeJS.ProcessEnv = process.env,
): Headers {
  const headers = new Headers(initHeaders);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("User-Agent", getMcpUserAgent(env));
  headers.set("X-Mcp-Client-Session-Id", getMcpClientSessionId());
  return headers;
}
