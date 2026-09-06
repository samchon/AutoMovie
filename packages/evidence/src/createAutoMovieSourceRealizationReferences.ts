import type { ITtscEvidenceGraphMarkdownReference } from "@ttsc/evidence";

/**
 * A generated source family whose authored realization has a review policy.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Names the generated source families governed by the production graph.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Keeps rendered realization policy attached to the actual source branch.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Defines the source-family input used by the graph reference builder.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Uses the same closed source population as the staged production declaration.
 */
export type AutoMovieSourceRealizationBranch =
  | "filmSources"
  | "instanceSources"
  | "mapSources"
  | "materialSources"
  | "modelSources"
  | "motionSources"
  | "productionSources"
  | "shots"
  | "spaceSources"
  | "systemSources";

/** Rendered realization, not source construction or a finite review plan. */
const RENDERED: Readonly<Record<AutoMovieSourceRealizationBranch, boolean>> = {
  filmSources: true,
  instanceSources: true,
  mapSources: true,
  materialSources: true,
  modelSources: true,
  motionSources: true,
  productionSources: false,
  shots: true,
  spaceSources: true,
  systemSources: false,
};

/**
 * Keep realization coverage and cardinality blocking while an unobserved
 * render remains payable after source compilation. Only the authored
 * realization reference uses this policy; source principles, upstream checks,
 * obligations, and authored population accounts remain independent errors.
 * The native evaluator owns both references and their review fingerprints.
 *
 * @evidence requirements/production-evidence/README.md#production-evidence-requirements Separates initial construction from the rendered evidence a completed production owes.
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-shape-stage Keeps source realization structural enforcement active while deferring its rendered review payment.
 * @evidence specifications/production-evidence/README.md#production-evidence-specifications Constructs native references without replacing their evaluator.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-shape-stage Separates error coverage from warning rendered freshness without weakening the owning mixed claim.
 */
export const createAutoMovieSourceRealizationReferences = (props: {
  branch: AutoMovieSourceRealizationBranch;
  reference: Omit<
    ITtscEvidenceGraphMarkdownReference,
    "severity" | "requireReview"
  >;
  requireReview: boolean;
}): ITtscEvidenceGraphMarkdownReference[] => {
  const rendered = RENDERED[props.branch];
  const structural: ITtscEvidenceGraphMarkdownReference = {
    ...props.reference,
    severity: "error",
    requireReview: props.requireReview && !rendered,
  };
  if (rendered && props.requireReview)
    return [
      structural,
      { ...props.reference, severity: "warning", requireReview: true },
    ];
  return [structural];
};
