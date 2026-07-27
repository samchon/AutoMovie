#!/usr/bin/env node
import { createAutoMovieProductionMcpServer } from "@automovie/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { captureProductionFrame } from "./capture";

const server = createAutoMovieProductionMcpServer({
  projectRoot: process.cwd(),
  capture: captureProductionFrame,
});
await server.connect(new StdioServerTransport());
