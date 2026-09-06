#!/usr/bin/env node
import { startAutoMovieMcpServer } from "./createAutoMovieMcpServer";

async function main(argv: readonly string[]): Promise<void> {
  if (argv.length !== 2 || argv[0] !== "--root")
    throw new Error("usage: automovie-mcp --root <absolute-production-root>");
  const manifest = require("../package.json") as { version: string };
  await startAutoMovieMcpServer(argv[1], manifest.version);
}

void main(process.argv.slice(2)).catch(() => {
  process.stderr.write(
    "automovie-mcp: unable to start; require --root <absolute-production-root> with physical read access.\n",
  );
  process.exitCode = 1;
});
