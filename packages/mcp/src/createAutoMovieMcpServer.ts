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
 *
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-authoring-api-refusal Exposes the fixed five-tool knowledge and evidence surface rather than a duplicate authoring API.
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-host-evidence Delegates actual pixel production to the configured host.
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-no-surprise-external-effects Requires explicit host configuration before an external repaint can execute.
 * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Consumes repository capability without synthesizing project model choices.
 * @evidence requirements/operations-and-recovery/scope-job-identity-and-state.md#operations-job-identity-inputs Makes project root and production identity immutable server inputs.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-authoring-invariant Keeps source authoring outside the server controller.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-host-evidence-output Keeps captured evidence attributable to the host adapter.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-tool-content-side-effect-invariant Prevents requests from enabling an undeclared provider execution path.
 * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Keeps catalogue capability with the system and model selection with the project.
 * @evidence specifications/execution-and-recovery/scope-and-execution-identities.md#execution-logical-job-identity Binds all served operations to one physical and logical production namespace.
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
