import {
  AutoMovieProductionGuideName,
  IAutoMovieGetGuideDocument,
} from "@automovie/interface";
import path from "node:path";

import { AutoMovieGuideName } from "../dto";
import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";

/** Installed MCP version attached to guide responses. */
const MCP_VERSION = (
  require(path.join(__dirname, "..", "..", "package.json")) as {
    version: string;
  }
).version;

/** Exact packaged guide lookup for the production coordinator. */
export class AutoMovieProductionGuideService {
  /** Serve one production guide by exact name. */
  public get(name: AutoMovieProductionGuideName): IAutoMovieGetGuideDocument {
    const guideName: AutoMovieGuideName = name;
    const content: string | undefined = AUTOMOVIE_GUIDE_CONSTANT[guideName];
    if (content === undefined)
      throw new Error(
        `Unknown production guide "${name}". Read AUTOMOVIE_OVERALL and use one of its production guide names.`,
      );
    return { name, version: MCP_VERSION, content };
  }
}
