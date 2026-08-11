#!/usr/bin/env node
import { createAutoMovieMcpServer } from "@automovie/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "../automovie.config";
import { productionArchetypes } from "./archetypes";
import { captureProductionFrame } from "./capture";

const server = createAutoMovieMcpServer({
  projectRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  productionId: config.productionId,
  capture: captureProductionFrame,
  // The same catalogue `npm run compile` builds against. The host reopens the
  // project to validate and capture, so a production whose registry is only
  // named in the compile script compiles with its own builder and then cannot
  // be photographed with it.
  archetypes: productionArchetypes,
});
await server.connect(new StdioServerTransport());
