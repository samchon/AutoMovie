import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import typia from "typia";

import { AutoFilmApplication } from "./AutoFilmApplication";

/**
 * Build the AutoFilm MCP server: wrap {@link AutoFilmApplication} in a
 * `typia.llm.controller` (which derives each method's validated tool schema at
 * compile time) and hand it to `@typia/mcp`'s `createMcpServer`. Connect the
 * returned server to a transport — `StdioServerTransport` for a spawned
 * subprocess (see `bin.ts`).
 *
 * @author Samchon
 */
export const createAutoFilmMcpServer = (): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoFilmApplication>(
      "autofilm",
      new AutoFilmApplication(),
    ),
    "0.1.0",
  );
