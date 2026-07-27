#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAutoMovieProductionMcpServer } from "./createAutoMovieProductionMcpServer";

/** Start the opt-in coding-agent production MCP server over stdio. */
const main = async (): Promise<void> => {
  const server = createAutoMovieProductionMcpServer({
    projectRoot: process.env.AUTOMOVIE_PROJECT_ROOT,
  });
  await server.connect(new StdioServerTransport());
};
void main();
