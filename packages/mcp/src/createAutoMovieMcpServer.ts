import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import path from "node:path";
import typia from "typia";

import { AutoMovieApplication } from "./AutoMovieApplication";
import { AutoMovieMcpFrameCapture } from "./dto";

/**
 * The installed MCP implementation version from its package manifest.
 *
 * `require` keeps the JSON outside the TypeScript `rootDir`. `__dirname` is
 * `src` under ttsx and `lib` in the published package, with `package.json` one
 * level above in both layouts.
 */
const MCP_PACKAGE_VERSION = (
  require(path.join(__dirname, "..", "package.json")) as { version: string }
).version;

/**
 * Build the AutoMovie MCP server: wrap {@link AutoMovieApplication} in a
 * `typia.llm.controller` (which derives each method's validated tool schema at
 * compile time) and hand it to `@typia/mcp`'s `createMcpServer`. Connect the
 * returned server to a transport, `StdioServerTransport` for a spawned
 * subprocess (see `bin.ts`).
 *
 * A host that owns a renderer can inject a `capture` adapter so `seeFrame`
 * returns real pixels; the plain stdio binary has none and `seeFrame` reports
 * `no-capture-adapter`.
 *
 * @author Samchon
 */
export const createAutoMovieMcpServer = (props?: {
  /** Host-owned frame capture used by `seeFrame`. */
  capture?: AutoMovieMcpFrameCapture;
  /** Project root to activate at startup (#614); tools may also openProject. */
  projectRoot?: string;
}): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoMovieApplication>(
      "automovie",
      new AutoMovieApplication(props),
    ),
    // Ship the serialized-JSON text block beside `structuredContent` on every
    // successful result. @typia/mcp 13.1.x defaults this off (structured-only),
    // which the dependency bump inherited silently; the published binary
    // advertises "any MCP client", so a client that reads `content` text and
    // ignores `outputSchema` must still receive the result. This restores the
    // pre-bump wire contract; the doubled payload is the cost of that reach.
    { version: MCP_PACKAGE_VERSION, textFallback: true },
  );
