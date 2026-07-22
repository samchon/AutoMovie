import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Budget for one MCP request against an already-running server. These are
 * in-process engine computations behind a pipe; a healthy one answers in
 * milliseconds, so this is a liveness guard, not a performance assertion.
 */
export const MCP_REQUEST_TIMEOUT = 120_000;

/**
 * Budget for bringing the server up and getting its tool list.
 *
 * This covers something categorically more expensive than a request: the server
 * starts as `ttsx src/bin.ts`, so the handshake waits on a **cold TypeScript
 * compilation** of `interface`, `engine`, `render`, and `mcp` through the typia
 * transformer, and the reply carries the whole tool schema (~2.6 MB). Measured
 * on a developer machine that also hosts other work, that start costs 100 s and
 * upward, and under a concurrent coverage run it passed 120 s, which is why
 * both stdio scenarios used to fail as a pair whenever the box was busy, on
 * `master`, with no relation to the change under test.
 *
 * The old 120 s was one number covering both phases, set close enough to the
 * compile cost that ordinary load flipped it. Splitting them is the fix: this
 * budget is sized for the compile with real headroom, and stays a
 * did-the-process-die guard rather than a stopwatch on the host.
 */
export const MCP_STARTUP_TIMEOUT = 300_000;

/** A live stdio client, with the server's tool list already read. */
export interface IAutoMovieMcpStdioSession {
  /** The connected client. Later calls take {@link MCP_REQUEST_TIMEOUT}. */
  client: Client;

  /** Every tool the server advertised on this handshake. */
  tools: Tool[];
}

/**
 * Spawn the MCP server over stdio and complete the handshake, returning the
 * connected client and its tool list.
 *
 * Every stdio scenario opens this way, so the spawn command and the two budgets
 * live here rather than being restated per test, the same single-source rule
 * the engine follows for a shared computation. Startup and the tool list run on
 * {@link MCP_STARTUP_TIMEOUT}; the caller's later requests take
 * {@link MCP_REQUEST_TIMEOUT}.
 *
 * The caller owns the client and must `close()` it.
 */
export const openMcpStdio = async (
  name: string,
  options?: {
    /** Select the 45-tool compatibility surface instead of the compact default. */
    surface?: "compact" | "granular";
  },
): Promise<IAutoMovieMcpStdioSession> => {
  const client = new Client({ name, version: "0.0.0" });
  const transport = new StdioClientTransport({
    command: "pnpm",
    args: [
      "--filter",
      "@automovie/mcp",
      options?.surface === "granular" ? "start:granular" : "start",
    ],
  });
  await client.connect(transport, { timeout: MCP_STARTUP_TIMEOUT });
  const { tools } = await client.listTools(undefined, {
    timeout: MCP_STARTUP_TIMEOUT,
  });
  return { client, tools };
};

/** What one probing tool call observed at the client. */
export interface IAutoMovieMcpProbe {
  /** Whether the tool refused the call. */
  refused: boolean;

  /** The serialized annotation text the client receives. */
  text: string;
}

/**
 * Call one compact-gateway operation and read the verdict the way a client
 * sees it: refused or not, plus the joined text of every content part.
 *
 * The helper wraps the operation in `execute.call`, the public compact wire
 * shape. Input validation is only observable through a real client (an
 * in-process `AutoMovieApplication` call bypasses typia entirely), so every
 * scenario that pins a boundary refusal needs this read. It lives here beside
 * the spawn and the budgets for the same reason they do: restating it per
 * scenario is how two copies of one observation drift apart.
 */
export const probeMcpTool = async (
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<IAutoMovieMcpProbe> => {
  const result = await client.callTool(
    {
      name: "execute",
      arguments: { call: { operation: name, input: args } },
    },
    undefined,
    { timeout: MCP_REQUEST_TIMEOUT },
  );
  const content = (result.content ?? []) as { text?: string }[];
  return {
    refused: result.isError === true,
    text: content.map((part) => part.text ?? "").join(""),
  };
};
