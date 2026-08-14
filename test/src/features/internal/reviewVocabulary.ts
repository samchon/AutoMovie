import { IAutoMovieReviewTarget } from "@automovie/interface";

/**
 * The review checklist every delegated reviewer has to submit, written out.
 *
 * These are the exact strings `submitReview` demands, once each and in this
 * order, and they are transcribed here rather than imported from
 * `AUTOMOVIE_REVIEW_CRITERIA` on purpose: a case that read the service's own
 * constant would agree with the gate whatever either of them said, and the
 * whole point of the vocabulary is that it is a contract between the gate, the
 * guide corpus that teaches it, and the agent that has to write it down.
 *
 * A criterion renamed in the implementation therefore fails here, which is the
 * moment to decide whether the guides and the agents relying on the old name
 * are being renamed with it.
 */
export const AUTOMOVIE_REVIEW_CRITERION_VOCABULARY = {
  asset: [
    "silhouette-and-proportion",
    "rig-convention-and-rom",
    "material-and-outline-legibility",
    "turntable-coverage",
  ],
  subject: [
    "identity-and-composition",
    "placement-and-bounds",
    "viewpoint-coverage",
    "subject-frame-separation",
  ],
  design: [
    "identity-and-references",
    "scope-and-ownership",
    "constraints-and-ranges",
    "downstream-consumability",
    "acceptance-coverage",
  ],
  source: [
    "binding-and-exports",
    "determinism",
    "engine-enforcement",
    "error-and-boundary-paths",
  ],
  shot: [
    "beat-fidelity",
    "staging-readability",
    "performance-credibility",
    "style-intent-justification",
    "representability",
    "acceptance-scenarios",
  ],
  rendition: [
    "visual-fidelity-to-source",
    "temporal-coherence",
    "anatomy-and-artifact-integrity",
    "reference-consistency",
  ],
  sequence: [
    "cross-shot-continuity",
    "rhythm-against-intent",
    "spatial-model-maintenance",
    "coverage-sufficiency",
    "acceptance-scenarios",
  ],
  film: [
    "narrative-completion",
    "tone-consistency",
    "delivery-readiness",
    "acceptance-scenarios",
  ],
} as const satisfies Record<IAutoMovieReviewTarget["kind"], readonly string[]>;

/**
 * The criterion a completed review may never discharge as not-applicable.
 *
 * Completion additionally requires the basis prose to name these, so a case
 * building a worksheet that is meant to be accepted has to know them.
 */
export const AUTOMOVIE_REVIEW_HIGH_RISK_CRITERIA = {
  asset: ["silhouette-and-proportion", "rig-convention-and-rom"],
  subject: ["identity-and-composition", "viewpoint-coverage"],
  design: ["identity-and-references"],
  source: ["determinism", "engine-enforcement"],
  shot: ["beat-fidelity", "representability"],
  rendition: ["visual-fidelity-to-source", "anatomy-and-artifact-integrity"],
  sequence: ["cross-shot-continuity", "spatial-model-maintenance"],
  film: ["narrative-completion", "delivery-readiness"],
} as const satisfies Record<IAutoMovieReviewTarget["kind"], readonly string[]>;
