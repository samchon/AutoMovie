import type { ITtscEvidenceGraphClaim } from "@ttsc/evidence";

import type { AutoMovieEvidenceStage } from "./AutoMovieEvidenceStage";
import type { AutoMovieProductionKind } from "./AutoMovieProductionKind";

/**
 * Declares one production's evidence topology and current layer states.
 *
 * Stages describe the active authoring harness, not a historical milestone.
 * Keep a completed layer in `review` so a changed target reopens its dependants.
 */
export interface IAutoMovieEvidenceConfigProps {
  /** Absolute generated-project root used to discover per-file references. */
  location: string;

  /** Selects the mutually exclusive film, direct-brief, or library topology. */
  kind: AutoMovieProductionKind;

  /** Sets the canonical settings-document stage. */
  settings: AutoMovieEvidenceStage;

  /** Sets the optional external-research ledger stage. */
  research: AutoMovieEvidenceStage;

  /** Sets the blocking-model design stage. */
  models: AutoMovieEvidenceStage;

  /** Sets the time-varying motion design stage. */
  motions: AutoMovieEvidenceStage;

  /** Sets the narrative-treatment stage used only by `film`. */
  storylines: AutoMovieEvidenceStage;

  /** Sets the physical scene-progression stage used only by `film`. */
  scenarios: AutoMovieEvidenceStage;

  /** Sets the final screenplay stage used only by `film`. */
  script: AutoMovieEvidenceStage;

  /** Sets the bounded audiovisual-brief stage used only by `brief`. */
  briefs: AutoMovieEvidenceStage;

  /** Sets the TypeScript model-source stage. */
  modelSources: AutoMovieEvidenceStage;

  /** Sets the TypeScript motion-source stage. */
  motionSources: AutoMovieEvidenceStage;

  /** Sets the authored shot and acceptance-source stage. */
  shots: AutoMovieEvidenceStage;

  /** Sets the production-design serialization source stage. */
  productionSources: AutoMovieEvidenceStage;

  /** Sets the final editorial timeline source stage. */
  filmSources: AutoMovieEvidenceStage;

  /**
   * Adds claims that belong only to this production.
   *
   * They follow the shared graph and may extend, but never replace, it.
   */
  claims?: ITtscEvidenceGraphClaim[];
}
