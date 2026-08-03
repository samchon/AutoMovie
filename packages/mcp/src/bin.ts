#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAutoMovieMcpServer } from "./createAutoMovieMcpServer";

/** Start AutoMovie's five-tool server from one host-owned workspace seed. */
const main = async (): Promise<void> => {
  const server = createAutoMovieMcpServer({
    projectRoot: process.env.AUTOMOVIE_PROJECT_ROOT ?? process.cwd(),
    productionId: process.env.AUTOMOVIE_PRODUCTION_ID,
  });
  await server.connect(new StdioServerTransport());
};
void main();
