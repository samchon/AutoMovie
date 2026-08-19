#!/usr/bin/env node
import { createAutoMovieMcpServer } from "@automovie/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

import config from "../automovie.config";
import { captureProductionFrame } from "./capture";
import { inspectProductionSubject } from "./inspectSubject";

const server = createAutoMovieMcpServer({
  projectRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  productionId: config.productionId,
  capture: captureProductionFrame,
  // Deliberately a second instrument rather than a second use of `capture`.
  // An inspection view decides what to fix and is never delivery evidence, and
  // one adapter serving both is how an inspection frame would eventually
  // acquire the receipt shape a shot review consumes.
  inspect: inspectProductionSubject,
});
await server.connect(new StdioServerTransport());
