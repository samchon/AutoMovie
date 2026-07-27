import { AutoMovieProductionFrameCapture } from "@automovie/interface";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import path from "node:path";
import typia from "typia";

import { AutoMovieProductionApplication } from "./AutoMovieProductionApplication";

/** Installed MCP package version. */
const MCP_PACKAGE_VERSION = (
  require(path.join(__dirname, "..", "package.json")) as { version: string }
).version;

/**
 * Build the opt-in coding-agent production MCP surface. It is measured beside
 * the current compact gateway before becoming the default. The server exposes
 * 15 narrow design/compiler/oracle/review tools directly, with no giant execute
 * union and no internal LLM.
 */
export const createAutoMovieProductionMcpServer = (props?: {
  /** Host-owned actual PNG capture. */
  capture?: AutoMovieProductionFrameCapture;
  /** Optional project-fixed root. */
  projectRoot?: string;
}): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoMovieProductionApplication, { equals: true }>(
      "automovie-production",
      new AutoMovieProductionApplication(props),
    ),
    { version: MCP_PACKAGE_VERSION, textFallback: true },
  );
