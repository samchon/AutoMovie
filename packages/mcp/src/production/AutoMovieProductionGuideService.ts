import {
  AutoMovieProductionGuideName,
  IAutoMovieGetGuideDocument,
} from "@automovie/interface";
import path from "node:path";

import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";

/** Installed MCP version attached to guide responses. */
const MCP_VERSION = (
  require(path.join(__dirname, "..", "..", "package.json")) as {
    version: string;
  }
).version;

/**
 * Exact guide names served by the five-tool application.
 *
 * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Enumerates the stable topic names an author can request.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Enumerates the exact topic document identities served as knowledge output.
 */
export const AUTOMOVIE_PRODUCTION_GUIDE_NAMES = [
  "AUTOMOVIE_OVERALL",
  "PRODUCTION_DESIGN",
  "MODEL_RECIPE",
  "WORLD_DESIGN",
  "FORMATION_DESIGN",
  "SHOT_CONTRACT",
  "ACCEPTANCE",
  "SOURCE_OWNERSHIP",
  "COMPILATION",
  "GEOMETRY",
  "CAPTURE_FRAME",
  "REPAINT_SHOT",
  "REVIEW_ASSET",
  "REVIEW_SHOT",
  "REVIEW_SEQUENCE",
  "REVIEW_FILM",
  "REVIEW_DEPENDENCY",
  "SCREENPLAY_WRITING",
  "CINEMATOGRAPHY",
  "EDITING",
  "OBJECT_RIGGING",
  "WORLD_BUILDING",
  "MOTION",
  "SOUND_DESIGN",
  "ASSET_SOURCING",
  "DIFFUSION_ENHANCE",
  "EVIDENCE_GRAPH",
  "SOURCE_COMPOSITION",
  "TYPESCRIPT",
  "DEBUGGING",
] as const satisfies readonly AutoMovieProductionGuideName[];

/**
 * Exact packaged guide lookup for the production coordinator.
 *
 * @evidence requirements/agent-authoring/mcp-boundary.md#agent-mcp-contract-guidance Delivers packaged contract guidance without modifying a production.
 * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Keeps knowledge lookup read-only and versioned.
 */
export class AutoMovieProductionGuideService {
  /**
   * Serve one production guide by exact name.
   *
   * @evidence requirements/agent-authoring/capability-discovery.md#agent-topic-document-discovery Resolves only one exact discoverable guide identity.
   * @evidence specifications/authoring-and-authority/knowledge-evidence-and-tool-boundary.md#spec-authoring-knowledge-request-output Returns the selected packaged document and version.
   */
  public get(name: AutoMovieProductionGuideName): IAutoMovieGetGuideDocument {
    const content: string | undefined = AUTOMOVIE_GUIDE_CONSTANT[name];
    if (content === undefined)
      throw new Error(
        `Unknown production guide "${name}". Use one exact name: ${AUTOMOVIE_PRODUCTION_GUIDE_NAMES.join(", ")}.`,
      );
    return { name, version: MCP_VERSION, content };
  }
}
