import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import typia from "typia";

import { AutoMovieApplication } from "./AutoMovieApplication";

/**
 * Build the AutoMovie MCP server: wrap {@link AutoMovieApplication} in a
 * `typia.llm.controller` (which derives each method's validated tool schema at
 * compile time) and hand it to `@typia/mcp`'s `createMcpServer`. Connect the
 * returned server to a transport — `StdioServerTransport` for a spawned
 * subprocess (see `bin.ts`).
 *
 * @author Samchon
 */
export const createAutoMovieMcpServer = (): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoMovieApplication>(
      "automovie",
      new AutoMovieApplication(),
    ),
    "0.1.0",
  );
