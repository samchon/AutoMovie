import { createMcpServer } from "@typia/mcp";
import path from "node:path";
import typia from "typia";
import { AutoMovieApplication } from "./AutoMovieApplication";
/** Installed MCP package version. */
const MCP_PACKAGE_VERSION = require(path.join(__dirname, "..", "package.json")).version;
/**
 * Build AutoMovie's complete five-tool MCP server. The host fixes workspace
 * identity and injects optional pixel/repaint adapters; tool payloads cannot
 * switch roots. Strict equality rejects excess properties and text fallback
 * keeps structured results available to ordinary MCP clients.
 */
export const createAutoMovieMcpServer = (props) => createMcpServer(typia.llm.controller("automovie", new AutoMovieApplication(props)), { version: MCP_PACKAGE_VERSION, textFallback: true });
//# sourceMappingURL=createAutoMovieMcpServer.js.map