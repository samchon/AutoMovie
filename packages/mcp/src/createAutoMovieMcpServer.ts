import {
  AutoMovieProductionFrameCapture,
  AutoMovieProductionShotRepaint,
} from "@automovie/interface";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpServer } from "@typia/mcp";
import path from "node:path";
import typia from "typia";

import { AutoMovieApplication } from "./AutoMovieApplication";
import type { AutoMovieModelArchetypeRegistry } from "./production/productionArchetypes";

/** Installed MCP package version. */
const MCP_PACKAGE_VERSION = (
  require(path.join(__dirname, "..", "package.json")) as { version: string }
).version;

/**
 * Build AutoMovie's complete five-tool MCP server. The host fixes workspace
 * identity and injects optional pixel/repaint adapters; tool payloads cannot
 * switch roots. Strict equality rejects excess properties and text fallback
 * keeps structured results available to ordinary MCP clients.
 */
export const createAutoMovieMcpServer = (props?: {
  /** Host-owned actual PNG capture. */
  capture?: AutoMovieProductionFrameCapture;
  /** Host-owned optional diffusion rendition. */
  repaint?: AutoMovieProductionShotRepaint;
  /** Host seed at or below the project root. */
  projectRoot?: string;
  /** Host-selected default production. */
  productionId?: string;
  /** Archetype catalogue the served productions register. */
  archetypes?: AutoMovieModelArchetypeRegistry;
}): McpServer =>
  createMcpServer(
    typia.llm.controller<AutoMovieApplication, { equals: true }>(
      "automovie",
      new AutoMovieApplication(props),
    ),
    { version: MCP_PACKAGE_VERSION, textFallback: true },
  );
