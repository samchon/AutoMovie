import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import typia from "typia";

import {
  AutoMovieApplication,
  AutoMovieMcpFrameCapture,
} from "./AutoMovieApplication";

/**
 * Build the AutoMovie MCP server: wrap {@link AutoMovieApplication} in a
 * `typia.llm.controller` (which derives each method's validated tool schema at
 * compile time) and hand it to `@typia/mcp`'s `createMcpServer`. Connect the
 * returned server to a transport — `StdioServerTransport` for a spawned
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
}): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoMovieApplication>(
      "automovie",
      new AutoMovieApplication(props),
    ),
    "0.1.0",
  );
