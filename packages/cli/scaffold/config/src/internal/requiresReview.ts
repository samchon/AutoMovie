import type { AutoMovieEvidenceStage } from "../AutoMovieEvidenceStage";

/** Whether a layer owns authored hosts in the selected production shape. */
export const hasEvidenceHosts = (stage: AutoMovieEvidenceStage): boolean =>
  stage !== "disabled";

/** Whether a layer participates in the compiled evidence graph. */
export const requiresEvidence = (stage: AutoMovieEvidenceStage): boolean =>
  stage === "evidence" || stage === "review";

/** Returns whether a layer requires current evidence-review fingerprints. */
export const requiresReview = (stage: AutoMovieEvidenceStage): boolean =>
  stage === "review";
