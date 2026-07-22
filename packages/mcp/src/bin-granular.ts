#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAutoMovieGranularMcpServer } from "./createAutoMovieMcpServer";

/** Start the compatibility server that advertises one tool per operation. */
const main = async (): Promise<void> => {
  const server = createAutoMovieGranularMcpServer();
  await server.connect(new StdioServerTransport());
};
void main();
