/**
 * Guide names served by the coding-agent production coordinator.
 *
 * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Exposes `AutoMovieProductionGuideName` as the portable data boundary for the agent author authority requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Types `AutoMovieProductionGuideName` for the spec authoring agent input output system contract.
 */
export type AutoMovieProductionGuideName =
  | "AUTOMOVIE_OVERALL"
  | "PRODUCTION_DESIGN"
  | "MODEL_RECIPE"
  | "DERIVED_ARTIFACTS"
  | "WORLD_DESIGN"
  | "FORMATION_DESIGN"
  | "SHOT_CONTRACT"
  | "ACCEPTANCE"
  | "SOURCE_OWNERSHIP"
  | "COMPILATION"
  | "GEOMETRY"
  | "CAPTURE_FRAME"
  | "REPAINT_SHOT"
  | "REVIEW_ASSET"
  | "REVIEW_SUBJECT"
  | "REVIEW_SHOT"
  | "REVIEW_SEQUENCE"
  | "REVIEW_FILM"
  | "REVIEW_DEPENDENCY"
  | "SCREENPLAY_WRITING"
  | "CINEMATOGRAPHY"
  | "EDITING"
  | "OBJECT_RIGGING"
  | "BUILT_ENVIRONMENT"
  | "BUILDING_STUDIES"
  | "SUBJECT_INSPECTION"
  | "VISUAL_CHANGE_REPORT"
  | "MOTION"
  | "SOUND_DESIGN"
  | "ASSET_SOURCING"
  | "DIFFUSION_ENHANCE"
  | "EVIDENCE_GRAPH"
  | "SOURCE_COMPOSITION"
  | "TYPESCRIPT"
  | "DEBUGGING";

/**
 * One packaged coding-agent production guide.
 *
 * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Exposes `IAutoMovieGetGuideDocument` as the portable data boundary for the agent author authority requirement.
 * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Types `IAutoMovieGetGuideDocument` for the spec authoring agent input output system contract.
 */
export interface IAutoMovieGetGuideDocument {
  /**
   * Exact served guide name.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Exposes `name` as the portable data boundary for the agent author authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Types `name` for the spec authoring agent input output system contract.
   */
  name: AutoMovieProductionGuideName;
  /**
   * MCP package version carrying this guide.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Exposes `version` as the portable data boundary for the agent author authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Types `version` for the spec authoring agent input output system contract.
   */
  version: string;
  /**
   * Markdown guide content.
   *
   * @evidence requirements/agent-authoring/roles-and-authorities.md#agent-author-authority Exposes `content` as the portable data boundary for the agent author authority requirement.
   * @evidence specifications/authoring-and-authority/delegation-and-decision-authority.md#spec-authoring-agent-input-output Types `content` for the spec authoring agent input output system contract.
   */
  content: string;
}

export namespace IAutoMovieGetGuideDocument {
  /**
   * Select one exact production guide; start with AUTOMOVIE_OVERALL.
   *
   * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Exposes `IProps` as the portable data boundary for the agent repository project boundary requirement.
   * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Types `IProps` for the spec authoring system project responsibility system contract.
   */
  export interface IProps {
    /**
     * Exact guide name.
     *
     * @evidence requirements/agent-authoring/project-ownership.md#agent-repository-project-boundary Exposes `name` as the portable data boundary for the agent repository project boundary requirement.
     * @evidence specifications/authoring-and-authority/capability-and-content-boundary.md#spec-authoring-system-project-responsibility Types `name` for the spec authoring system project responsibility system contract.
     */
    name: AutoMovieProductionGuideName;
  }
}
