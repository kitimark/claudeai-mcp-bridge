import { describe, expect, test } from "bun:test";
import { execFileSync } from "child_process";
import {
  getMcpClientSessionId,
  getMcpUserAgent,
  getMcpUserAgentVersion,
  withClaudeAiProxyHeaders,
} from "../src/mcp-identity.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("mcp identity headers", () => {
  test("builds default Claude Code User-Agent without optional metadata", () => {
    const userAgent = getMcpUserAgent({} as NodeJS.ProcessEnv);
    expect(userAgent).toBe("claude-code/0.1.0");
  });

  test("uses CLAUDE_CODE_UA_VERSION override for User-Agent version", () => {
    const version = getMcpUserAgentVersion({
      CLAUDE_CODE_UA_VERSION: "2.1.91",
    });
    const userAgent = getMcpUserAgent({
      CLAUDE_CODE_UA_VERSION: "2.1.91",
    });

    expect(version).toBe("2.1.91");
    expect(userAgent).toBe("claude-code/2.1.91");
  });

  test("builds Claude Code User-Agent with optional metadata in expected order", () => {
    const userAgent = getMcpUserAgent({
      CLAUDE_CODE_UA_VERSION: "2.1.91",
      CLAUDE_CODE_ENTRYPOINT: "cli",
      CLAUDE_AGENT_SDK_VERSION: "1.2.3",
      CLAUDE_AGENT_SDK_CLIENT_APP: "my-app/9.0.0",
    });

    expect(userAgent).toBe(
      "claude-code/2.1.91 (cli, agent-sdk/1.2.3, client-app/my-app/9.0.0)",
    );
  });

  test("reuses one MCP session id in a process", () => {
    const sessionA = getMcpClientSessionId();
    const sessionB = getMcpClientSessionId();

    expect(sessionA).toBe(sessionB);
    expect(UUID_V4_PATTERN.test(sessionA)).toBe(true);
  });

  test("uses a different MCP session id across process restarts", () => {
    const cwd = process.cwd();
    const program =
      "import { getMcpClientSessionId } from './src/mcp-identity.ts'; console.log(getMcpClientSessionId());";

    const run = () =>
      execFileSync(process.execPath, ["--eval", program], {
        cwd,
        encoding: "utf-8",
      }).trim();

    const first = run();
    const second = run();

    expect(UUID_V4_PATTERN.test(first)).toBe(true);
    expect(UUID_V4_PATTERN.test(second)).toBe(true);
    expect(first).not.toBe(second);
  });

  test("applies Authorization, User-Agent, and session headers", () => {
    const headers = withClaudeAiProxyHeaders(
      { "x-extra": "keep-me" },
      "test-token",
      {
        CLAUDE_CODE_UA_VERSION: "2.1.91",
        CLAUDE_CODE_ENTRYPOINT: "cli",
      },
    );

    expect(headers.get("authorization")).toBe("Bearer test-token");
    expect(headers.get("user-agent")).toBe("claude-code/2.1.91 (cli)");
    expect(headers.get("x-mcp-client-session-id")).toBe(getMcpClientSessionId());
    expect(headers.get("x-extra")).toBe("keep-me");
  });
});
