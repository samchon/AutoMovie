import {
  AutoMovieProductionGuideName,
  IAutoMovieGetGuideDocument,
} from "@automovie/interface";
import path from "node:path";

import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";
import type { AutoMovieProductionContext } from "./AutoMovieProductionContext";

/** Installed MCP version attached to guide responses. */
const MCP_VERSION = (
  require(path.join(__dirname, "..", "..", "package.json")) as {
    version: string;
  }
).version;

/**
 * Exact guide names served by the application.
 */
export const AUTOMOVIE_PRODUCTION_GUIDE_NAMES = [
  "AUTOMOVIE_OVERALL",
  "PRODUCTION_DESIGN",
  "MODEL_RECIPE",
  "DERIVED_ARTIFACTS",
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
  "REVIEW_SUBJECT",
  "REVIEW_SHOT",
  "REVIEW_SEQUENCE",
  "REVIEW_FILM",
  "REVIEW_DEPENDENCY",
  "SCREENPLAY_WRITING",
  "CINEMATOGRAPHY",
  "EDITING",
  "OBJECT_RIGGING",
  "WORLD_BUILDING",
  "SUBJECT_INSPECTION",
  "VISUAL_CHANGE_REPORT",
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
 */
export class AutoMovieProductionGuideService {
  /**
   * Deliver one guide and credit this session for reading it.
   *
   * The credit is recorded after the lookup, so a misspelled name teaches
   * nothing and unlocks nothing.
   */
  public serve(
    context: AutoMovieProductionContext,
    props: IAutoMovieGetGuideDocument.IProps,
  ): IAutoMovieGetGuideDocument {
    const output = this.get(props.name);
    context.recordGuide(props.name);
    return output;
  }

  /**
   * Serve one production guide by exact name.
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
