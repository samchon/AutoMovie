/** Guide names served by the coding-agent production coordinator. */
export type AutoMovieProductionGuideName =
  | "AUTOMOVIE_OVERALL"
  | "PRODUCTION_DESIGN"
  | "MODEL_RECIPE"
  | "WORLD_DESIGN"
  | "FORMATION_DESIGN"
  | "SHOT_CONTRACT"
  | "ACCEPTANCE"
  | "SOURCE_OWNERSHIP"
  | "COMPILATION"
  | "GEOMETRY"
  | "PRODUCTION_REVIEW"
  | "PRODUCTION_RENDER";

/** One packaged coding-agent production guide. */
export interface IAutoMovieGetGuideDocument {
  /** Exact served guide name. */
  name: AutoMovieProductionGuideName;
  /** MCP package version carrying this guide. */
  version: string;
  /** Markdown guide content. */
  content: string;
}

export namespace IAutoMovieGetGuideDocument {
  /** Select one exact production guide; start with AUTOMOVIE_OVERALL. */
  export interface IProps {
    /** Exact guide name. */
    name: AutoMovieProductionGuideName;
  }
}
