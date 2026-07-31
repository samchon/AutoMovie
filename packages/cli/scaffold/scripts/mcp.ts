#!/usr/bin/env node
import { createAutoMovieMcpServer } from "@automovie/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "../automovie.config";
import { captureProductionFrame } from "./capture";

const server = createAutoMovieMcpServer({
  projectRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  productionId: config.productionId,
  capture: captureProductionFrame,
});
await server.connect(new StdioServerTransport());
