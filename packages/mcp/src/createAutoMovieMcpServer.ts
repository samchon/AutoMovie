import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import typia from "typia";

import { automovieApplication } from "./AutomovieApplication";

/**
 * Build the automovie MCP server: wrap {@link automovieApplication} in a
 * `typia.llm.controller` (which derives each method's validated tool schema at
 * compile time) and hand it to `@typia/mcp`'s `createMcpServer`. Connect the
 * returned server to a transport ??`StdioServerTransport` for a spawned
 * subprocess (see `bin.ts`).
 *
 * @author Samchon
 */
export const createautomovieMcpServer = (): McpServer =>
  createMcpServer(
    typia.llm.controller<automovieApplication>(
      "automovie",
      new automovieApplication(),
    ),
    "0.1.0",
  );
