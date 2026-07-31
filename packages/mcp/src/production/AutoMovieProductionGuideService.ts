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

/** Exact guide names served by the five-tool application. */
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
  "PRODUCTION_REVIEW",
  "PRODUCTION_RENDER",
] as const satisfies readonly AutoMovieProductionGuideName[];

/** Exact packaged guide lookup for the production coordinator. */
export class AutoMovieProductionGuideService {
  /** Serve one production guide by exact name. */
  public get(name: AutoMovieProductionGuideName): IAutoMovieGetGuideDocument {
    const content: string | undefined = AUTOMOVIE_GUIDE_CONSTANT[name];
    if (content === undefined)
      throw new Error(
        `Unknown production guide "${name}". Use one exact name: ${AUTOMOVIE_PRODUCTION_GUIDE_NAMES.join(", ")}.`,
      );
    return { name, version: MCP_VERSION, content };
  }
}
