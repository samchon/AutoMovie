import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
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
 * What a topology-derived library observation opens, and why it is required.
 *
 * The roles are the failure classes a building review is counted over, and they
 * do not substitute for one another: an elevation cannot show the corner join
 * two elevations hide between them, a corner cannot show the room behind the
 * wall, and one room's interior says nothing about its siblings.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Names each role the derived population charges a library owner for.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the closed role set the topology derivation partitions by.
 * @author Samchon
 */
export type AutoMovieLibraryObservationRole =
  | "context"
  | "corner"
  | "entrance"
  | "facade"
  | "interior-center"
  | "interior-corner"
  | "interior-threshold"
  | "roof"
  | "underside";

/**
 * Where a derived interior eye was proved to stand and what it looks at.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Carries the proved interior camera an interior observation is judged from.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the derived pose whose position is inside the space it names.
 * @author Samchon
 */
export interface IAutoMovieLibraryObservationPose {
  /** World eye position, proved inside {@link space}'s own stated volume. */
  position: IAutoMovieVector3;
  /** Unit view direction. */
  direction: IAutoMovieVector3;
  /** World point the eye is aimed at. */
  target: IAutoMovieVector3;
  /** Logical space the eye stands in, or null for an exterior observation. */
  space: string | null;
}

/**
 * One observation a library owner's compiled topology requires of it.
 *
 * The population is derived rather than declared, which is the whole point: a
 * plan may add questions to it and may never take one away, so an owner cannot
 * be covered by a few flattering angles and still read complete.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Makes the required population a function of the compiled topology rather than of the author.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types one member of the derived, non-shrinkable required population.
 * @author Samchon
 */
export interface IAutoMovieLibraryRequiredObservation {
  /** Stable id the plan must declare and a receipt must pay. */
  id: string;
  /** Failure class this observation answers. */
  role: AutoMovieLibraryObservationRole;
  /** Stable compiled subject address the observation opens. */
  subject: string;
  /** Building unit the requirement descends from. */
  building: string;
  /** Topology address the requirement was derived from. */
  origin: string;
  /**
   * Where an interior eye was proved to stand, or null.
   *
   * An exterior observation is framed from the subject's own extent by the
   * instrument that draws it, so the topology fixes which face must be opened
   * rather than where the camera stands. An interior observation is the
   * opposite: that the eye is inside the room is the claim being made, so the
   * point is derived, proved against that room's own volume, and carried here.
   */
  pose: IAutoMovieLibraryObservationPose | null;
}

/**
 * Why a required canonical observation is excused from being opened.
 *
 * A redundant face may be left out only when another view and an explicit
 * identity or mirror statement disclose it, which is the boundary the design
 * disclosure guidance draws. `in-use-invisibility` covers the third case a
 * building adds: a face no observer can ever reach in the work's own use.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Fixes the closed set of grounds a canonical observation may be waived on.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the waiver ground the review gate reopens.
 * @author Samchon
 */
export type AutoMovieLibraryObservationWaiverGround =
  | "identity"
  | "in-use-invisibility"
  | "symmetry";

/**
 * One addressable excuse for a required observation the plan does not open.
 *
 * A waiver is a typed thing rather than an absent requirement, which is what
 * keeps it reviewable: it names the observation it excuses, the ground it rests
 * on, the other required observation that discloses the same form, and the
 * concrete fact that makes the ground true.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Models a waived face as an addressed record instead of a missing requirement.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the waiver whose ground, discloser, and reason the gate reopens.
 * @author Samchon
 */
export interface IAutoMovieLibraryReviewWaiver {
  /** Required observation id this waiver excuses. */
  observation: string;
  /** Ground the excuse rests on. */
  ground: AutoMovieLibraryObservationWaiverGround;
  /**
   * Another required observation this plan opens that establishes the ground.
   *
   * For `symmetry` and `identity` it is the view that discloses the same form.
   * For `in-use-invisibility` it is the view that shows the face cannot be
   * reached, which is what keeps every ground answerable by something somebody
   * actually looked at rather than by an assertion.
   */
  disclosedBy: string;
  /** Concrete statement of the fact that makes the ground true. */
  reason: string;
}

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
  /**
   * Where the eye actually stood, or null for an exterior observation.
   *
   * The requirement carries the pose an interior observation was *proved* to
   * admit; this carries the pose the instrument actually used. Without it a
   * receipt says which question it answered and never from where, so an
   * interior observation drawn from the corridor outside is indistinguishable
   * from one drawn inside the room — and being inside the room is the entire
   * claim that observation makes.
   *
   * Null on an exterior observation for the reason the requirement gives: the
   * frame comes from the subject's own extent, so there is no chosen point to
   * report. Null on an interior one is a receipt that never says where it
   * stood, and is refused rather than read as "anywhere".
   */
  pose: IAutoMovieLibraryObservationPose | null;
  /**
   * What the observation read, keyed by measurement name.
   *
   * A picture proves the eye was somewhere; it does not say what was taken
   * from it. An observation that reports a clear height, a sill line, or a
   * tread depth is making a claim a later reader can check against the model,
   * and one that reports nothing is a photograph with a verdict attached.
   *
   * Empty is a legitimate reading for an observation whose whole answer is the
   * picture, and it is written rather than omitted so a reader can tell "read
   * nothing" from "an older receipt that could not say".
   */
  measurements: Readonly<Record<string, number>>;
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
  /**
   * Addressed excuses for derived observations this plan does not open.
   *
   * Omitted is equivalent to none. A waiver participates in the plan identity,
   * so excusing a face after the fact expires every receipt on this owner
   * rather than quietly shrinking what the owner owed.
   */
  waivers?: IAutoMovieLibraryReviewWaiver[];
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
 * One derived observation resolved to the exact branch and H2 that owes it.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Keeps each derived viewpoint addressed to the owner whose topology produced it.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types the owner-addressed member of the derived required population.
 * @author Samchon
 */
export interface IAutoMovieLibraryResolvedRequirement extends IAutoMovieLibraryRequiredObservation {
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
  /**
   * Observations the owners' compiled topology requires of them.
   *
   * Empty when no owner materialized a building topology, which is a fact about
   * what the compiler published rather than a licence to declare nothing: the
   * plans' own finite observations remain the denominator either way.
   */
  required: IAutoMovieLibraryResolvedRequirement[];
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
