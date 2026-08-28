import { IAutoMovieDiagnostic } from "./IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";

/**
 * Physical evidence forms a finite library observation may require.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Keeps model views, exact artifacts, and structured domain facts distinct.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the closed observation-kind discriminator consumed by library review.
 * @author Samchon
 */
export type AutoMovieLibraryReviewEvidenceKind =
  | "artifact"
  | "facts"
  | "turntable";

/**
 * Current identity shared by one library design owner and all its receipts.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Expires observations after their design, source, compile, or finite plan changes.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the four-part freshness key derived independently by the compiler.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewOwnerIdentity {
  /** Exact H2 content identity. */
  design: AutoMovieContentDigest;
  /** Selected source binding and normalized source-byte identity. */
  source: AutoMovieContentDigest;
  /** Current compiler input identity, or null before generation exists. */
  generated: AutoMovieContentDigest | null;
  /** Canonical finite observation-plan identity, excluding receipts. */
  plan: AutoMovieContentDigest;
}

/**
 * Exact project-text or renderer-owned artifact offered as an observation.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Requires physical observation bytes rather than file existence or an exit code.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types an independently reopened artifact receipt.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewArtifactEvidence {
  /** Physical artifact discriminator. */
  kind: "artifact";
  /** Ownership root through which the compiler reopens the artifact. */
  root: "project" | "render";
  /** Root-relative portable artifact path. */
  path: string;
  /** Digest of the exact observed bytes. */
  digest: AutoMovieContentDigest;
}

/**
 * Canonical structured facts offered as a non-frame observation.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Lets motion, system, instance, and other nonvisual domains pay finite observations without dummy shots.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types facts whose canonical digest is independently recomputed.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewFactsEvidence {
  /** Structured-facts discriminator. */
  kind: "facts";
  /** JSON-compatible measured or inspected facts, without a hidden verdict. */
  facts: unknown;
  /** Digest of the canonical structured facts. */
  digest: AutoMovieContentDigest;
}

/**
 * Fixed whole-model turntable offered as model-library evidence.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Requires the current compiled model's canonical views and applicable rig range.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Binds a model observation to the compiler-owned fixed turntable set.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewTurntableEvidence {
  /** Canonical model-turntable discriminator. */
  kind: "turntable";
  /** Exact compiled model recipe observed by the fixed view set. */
  model: string;
}

/**
 * Physical evidence carried by one library observation receipt.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Separates exact bytes, structured facts, and canonical model views.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the evidence union reopened by the compiler.
 * @author Samchon
 */
export type AutoMovieLibraryReviewEvidence =
  | IAutoMovieLibraryReviewArtifactEvidence
  | IAutoMovieLibraryReviewFactsEvidence
  | IAutoMovieLibraryReviewTurntableEvidence;

/**
 * One finite observation declared by a library design owner.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Gives every delivered H2 a bounded, falsifiable observation denominator.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types one stable member of the owner plan.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewObservationPlan {
  /** Stable nonblank observation identity inside its H2 owner. */
  id: string;
  /** Physical evidence kind this observation requires. */
  evidence: AutoMovieLibraryReviewEvidenceKind;
  /** Exact compiled model; present only for model turntables. */
  model?: string;
}

/**
 * One persisted result offered for a finite library observation.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Requires current physical evidence, a named runtime, and an honest terminal verdict.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the receipt independently reopened and aggregated by the compiler.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewObservationReceipt {
  /** Observation id paid by this receipt. */
  observation: string;
  /** Exact physical evidence or structured facts offered. */
  evidence: AutoMovieLibraryReviewEvidence;
  /** Current owner identity under which the observation ran. */
  identity: IAutoMovieLibraryReviewOwnerIdentity;
  /** Named tool and runtime version that produced the observation. */
  runtimeIdentity: string;
  /** Actual terminal result; only one current passed receipt completes review. */
  verdict: "failed" | "not-run" | "passed" | "unsupported";
}

/**
 * Strict version-1 plan for one exact design H2 owner.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Binds an owner to exact source files, finite observations, and their receipts.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the per-H2 plan whose canonical content participates in freshness.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewUnitPlan {
  /** Exact H2 anchor without a leading hash. */
  anchor: string;
  /** Exact source subset inside the manifest-derived branch population. */
  sources: string[];
  /** Finite observations capable of falsifying this owner. */
  observations: IAutoMovieLibraryReviewObservationPlan[];
  /** Historical and current physical observation receipts. */
  receipts: IAutoMovieLibraryReviewObservationReceipt[];
}

/**
 * Adjacent tracked library review plan and receipt file.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Makes every current H2 owner and its observation result mechanically addressable.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the strict file consumed without becoming an approval or finding ledger.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewPlanFile {
  /** Closed schema version. */
  version: 1;
  /** Exact per-H2 plan population. */
  units: IAutoMovieLibraryReviewUnitPlan[];
}

/**
 * One exact delivered library owner resolved from authoring truth and its plan.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Exposes every active H2 owner and finite planned observation.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the planned denominator before receipts are aggregated.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewOwner {
  /** Active manifest-derived design branch. */
  branch: string;
  /** Stable project-document and H2 address. */
  owner: string;
  /** Current four-part owner identity. */
  identity: IAutoMovieLibraryReviewOwnerIdentity;
  /** Exact finite observation denominator. */
  observations: Array<{
    id: string;
    evidence: AutoMovieLibraryReviewEvidenceKind;
  }>;
}

/**
 * One plan receipt resolved to the exact branch and H2 that own it.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Prevents a receipt for another owner from paying the current owner.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the owner-addressed receipt aggregated by the completeness gate.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewResolvedReceipt extends IAutoMovieLibraryReviewObservationReceipt {
  /** Active manifest-derived design branch. */
  branch: string;
  /** Exact design-document and H2 address. */
  owner: string;
}

/**
 * One fixed model-turntable requirement derived from an owner plan.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Keeps the model and exact observation address together.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the canonical model view requirement consumed by capture diagnostics.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewTurntableRequirement {
  /** Active model-design branch. */
  branch: string;
  /** Exact model design-document and H2 address. */
  owner: string;
  /** Stable finite observation identity. */
  observation: string;
  /** Exact compiled model recipe. */
  model: string;
}

/**
 * Exact graph-derived library review population and its resolution diagnostics.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Carries active branches including an empty owner population, exact owners, receipts, and model views.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the complete planned and received population used at review and final.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewPopulation {
  /** Active reviewed branch denominator in stable order. */
  branches: string[];
  /** Structural plan, lineage, and identity refusals. */
  diagnostics: IAutoMovieDiagnostic[];
  /** Exact graph-derived H2 owners. */
  owners: IAutoMovieLibraryReviewOwner[];
  /** Receipts resolved from their adjacent owner files. */
  receipts: IAutoMovieLibraryReviewResolvedReceipt[];
  /** Canonical whole-model view requirements. */
  turntables: IAutoMovieLibraryReviewTurntableRequirement[];
}

/**
 * Read-only project surface required to resolve and reopen library evidence.
 *
 * @evidence requirements/review/subject-inspection.md#review-library-delivery-coverage Lets the gate reopen plans, sources, and observation artifacts without a second filesystem authority.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-library-delivery-coverage Types the minimum read boundary shared by compiler and offline authoring commands.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewProjectReader {
  /** Absolute project root matched to the authoring snapshot. */
  root: string;
  /** Read project-owned text, returning null when absent or unsafe. */
  readProseDocument(path: string): string | null;
  /** Reopen renderer-owned artifact bytes. */
  readRenderFile(path: string): Uint8Array;
  /** Reopen one exact source file selected by the manifest binding. */
  readSource(path: string): Uint8Array;
}
