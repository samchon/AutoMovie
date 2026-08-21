import type { AutoMovieEvidenceStage } from "../AutoMovieEvidenceStage";

/** Returns whether a layer requires current evidence-review fingerprints. */
export const requiresReview = (stage: AutoMovieEvidenceStage): boolean =>
  stage === "review";
