#!/usr/bin/env node
import { createAutoMovieMcpServer } from "@automovie/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import config from "../automovie.config";
import { captureProductionFrame } from "./capture";

const server = createAutoMovieMcpServer({
  projectRoot: process.cwd(),
  productionId: config.productionId,
  capture: captureProductionFrame,
});
await server.connect(new StdioServerTransport());
