import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import path from "node:path";
import typia from "typia";

import { AutoMovieApplication } from "./AutoMovieApplication";
import { AutoMovieGatewayApplication } from "./AutoMovieGatewayApplication";
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
 * Build the default compact AutoMovie MCP server: wrap
 * {@link AutoMovieGatewayApplication} in a `typia.llm.controller` and hand it to
 * `@typia/mcp`'s `createMcpServer`. The gateway keeps the three operating entry
 * points independent and places the other operations in one typed `execute`
 * union, so clients receive the shared schema graph once instead of once per
 * method. Connect the returned server to a transport, `StdioServerTransport`
 * for a spawned subprocess (see `bin.ts`).
 *
 * A host that owns a renderer can inject a `capture` adapter so `seeFrame`
 * returns real pixels; the plain stdio binary has none and `seeFrame` reports
 * `no-capture-adapter`.
 *
 * Tool inputs are validated with typia's `validateEquals` (the `equals: true`
 * schema config), so an excess property is refused where the caller wrote it
 * rather than tolerated (see the call site).
 *
 * @author Samchon
 */
export const createAutoMovieMcpServer = (props?: {
  /** Host-owned frame capture used by the `seeFrame` operation. */
  capture?: AutoMovieMcpFrameCapture;
  /** Project root to activate at startup (#614); clients may also openProject. */
  projectRoot?: string;
}): McpServer =>
  createMcpServer(
    // `equals: true` selects typia's `validateEquals` over `validate`, so an
    // excess property is refused at the INPUT boundary. Without it one
    // authoring mistake got two opposite answers (#1340): a stray property on
    // an input-only object was accepted and silently discarded, while the same
    // stray property on an object the engine echoes into its result survived
    // into the output, failed OUTPUT validation, and blamed the output for the
    // caller's input. The compact gateway makes that input path
    // `$input.call.input...`; strict input names it where it was written, before
    // the engine runs, and every operation answers the same way.
    typia.llm.controller<AutoMovieGatewayApplication, { equals: true }>(
      "automovie",
      new AutoMovieGatewayApplication(props),
    ),
    // Ship the serialized-JSON text block beside `structuredContent` on every
    // successful result. @typia/mcp 13.1.x defaults this off (structured-only),
    // which the dependency bump inherited silently; the published binary
    // advertises "any MCP client", so a client that reads `content` text and
    // ignores `outputSchema` must still receive the result. This restores the
    // pre-bump wire contract; the doubled payload is the cost of that reach.
    { version: MCP_PACKAGE_VERSION, textFallback: true },
  );

/**
 * Build the legacy fine-grained MCP surface with one advertised tool per
 * {@link AutoMovieApplication} method. Prefer {@link createAutoMovieMcpServer}
 * for external clients: this compatibility surface repeats the shared schema
 * closure per tool and can exceed ordinary model context windows.
 *
 * @author Samchon
 */
export const createAutoMovieGranularMcpServer = (props?: {
  /** Host-owned frame capture used by `seeFrame`. */
  capture?: AutoMovieMcpFrameCapture;
  /** Project root to activate at startup; tools may also openProject. */
  projectRoot?: string;
}): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoMovieApplication, { equals: true }>(
      "automovie",
      new AutoMovieApplication(props),
    ),
    { version: MCP_PACKAGE_VERSION, textFallback: true },
  );
