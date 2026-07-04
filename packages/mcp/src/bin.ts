#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createautomovieMcpServer } from "./CreateautomovieMcpServer";

/**
 * The automovie MCP server entry point: expose the film engine's tools over
 * stdio so an MCP client (Codex, Claude Desktop, ?? can spawn this as a
 * subprocess and drive the pipeline. Configure it as, e.g., `command: "npx",
 * args: ["@automovie/mcp"]` (or `node lib/bin.js`).
 *
 * @author Samchon
 */
const main = async (): Promise<void> => {
  const server = createautomovieMcpServer();
  await server.connect(new StdioServerTransport());
};
void main();
