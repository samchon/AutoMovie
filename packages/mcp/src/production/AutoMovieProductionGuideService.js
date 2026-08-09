import path from "node:path";
import { AUTOMOVIE_GUIDE_CONSTANT } from "../guides/AutoMovieGuideConstant";
/** Installed MCP version attached to guide responses. */
const MCP_VERSION = require(path.join(__dirname, "..", "..", "package.json")).version;
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
];
/** Exact packaged guide lookup for the production coordinator. */
export class AutoMovieProductionGuideService {
    /** Serve one production guide by exact name. */
    get(name) {
        const content = AUTOMOVIE_GUIDE_CONSTANT[name];
        if (content === undefined)
            throw new Error(`Unknown production guide "${name}". Use one exact name: ${AUTOMOVIE_PRODUCTION_GUIDE_NAMES.join(", ")}.`);
        return { name, version: MCP_VERSION, content };
    }
}
//# sourceMappingURL=AutoMovieProductionGuideService.js.map