import { IAutoMovieVector3 } from "../geometry/IAutoMovieVector3";
import { IAutoMovieCompiledFormation } from "./IAutoMovieProductionCompiler";
import { AutoMovieContentDigest } from "./IAutoMovieProductionDesign";
import { IAutoMovieCaptureRuntimeIdentity } from "./IAutoMovieProductionOracle";
import {
  IAutoMovieSubjectDescription,
  IAutoMovieSubjectMemberSummary,
} from "./IAutoMovieSubjectDescription";

/**
 * One compiled subject addressed independently from a film-time review target.
 *
 * The shot identifies the compiled artifact that owns the stable subject id. It
 * is not a claim that the subject review observes that shot or its camera.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity Keeps the review address on one stable authored subject and revision-bearing compiled artifact.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record Types the artifact-qualified address used to resolve one subject record.
 * @author Samchon
 */
export interface IAutoMovieSubjectReviewTarget {
  /** Compiled shot artifact that contains the subject. */
  shot: string;
  /** Stable namespaced subject id inside the compiled artifact. */
  subject: string;
}

/**
 * One inspection-owned viewpoint required by a subject review.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Gives the inspection an explicit viewpoint independent from authored cameras and film time.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-viewpoint-plan Types one deterministic member of the inspection-owned viewpoint plan.
 * @author Samchon
 */
export interface IAutoMovieSubjectReviewViewpoint {
  /** Stable identity unique inside the plan. */
  id: string;
  /** Unit viewing direction from the subject toward the inspection camera. */
  direction: IAutoMovieVector3;
  /** Positive camera distance in metres. */
  distance: number;
  /** Projection used to inspect this viewpoint. */
  projection: "perspective" | "orthographic";
  /** Inspection pose identity, or null for the subject's rest state. */
  pose: string | null;
  /** Additional inspection state identity, or null when none applies. */
  state: string | null;
}

/**
 * Exact inspection camera state that produced one subject observation.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Makes the observed pose part of the reopenable subject receipt rather than an unrecorded host choice.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation Types the exact coordinate space, eye, target, lens and clipping state paired with a subject artifact.
 * @author Samchon
 */
export interface IAutoMovieSubjectReviewPose {
  /** Coordinate basis shared by the eye and target. */
  coordinateSpace: "model" | "world";
  /** Eye position in metres. */
  position: IAutoMovieVector3;
  /** Point the eye looks at, in metres. */
  target: IAutoMovieVector3;
  /** Vertical field of view in degrees. */
  fovDeg: number;
  /** Viewport width divided by height. */
  aspect: number;
  /** Near clip distance in metres. */
  near: number;
  /** Far clip distance in metres. */
  far: number;
}

/**
 * Receipt for one subject observation made from an inspection-owned viewpoint.
 *
 * The `kind` discriminator deliberately differs from frame evidence. A shot
 * capture therefore cannot satisfy subject coverage merely because it contains
 * the subject.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Binds an observation to the subject, compiled revision, viewpoint and exact artifact that was inspected.
 * @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange Makes subject-view evidence structurally distinct from frame and range evidence.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation Types the independently addressable subject observation record.
 * @evidencePart specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation::subject-observation
 * @evidence specifications/review-and-acceptance/target-scope-and-context.md#review-system-presentation-context Preserves the subject, viewpoint, pose, artifact, evidence kind, runtime identity, and terminal status that bound the observation.
 * @evidencePart specifications/review-and-acceptance/target-scope-and-context.md#review-system-presentation-context::presentation-context
 * @author Samchon
 */
export interface IAutoMovieSubjectReviewObservation {
  /** Evidence discriminator; a frame receipt has another kind. */
  kind: "subject-view";
  /** Production namespace that owns the inspection. */
  productionId: string;
  /** Exact artifact-qualified subject target. */
  target: IAutoMovieSubjectReviewTarget;
  /** Exact compiled subject identity observed. */
  subject: string;
  /** Compiled artifact revision from which the observation was rendered. */
  revision: string;
  /** Current source compile identity used for the observation. */
  compileFingerprint: AutoMovieContentDigest;
  /** Canonical identity of the exact ordered plan and its poses. */
  planIdentity: AutoMovieContentDigest;
  /** Required viewpoint identity this observation answers. */
  viewpoint: string;
  /** Exact camera state used to draw the artifact. */
  pose: IAutoMovieSubjectReviewPose;
  /** Complete actual capture runtime, including the inspected graphics. */
  runtimeIdentity: IAutoMovieCaptureRuntimeIdentity;
  /** Stable identity of the image or inspection artifact. */
  artifact: string;
  /** Content digest of the exact inspected artifact. */
  digest: AutoMovieContentDigest;
  /** Only a terminal passed observation can satisfy coverage. */
  verdict: "passed";
  /** Subject inspection is never delivery evidence. */
  deliveryEvidence: false;
}

/**
 * One compact compiled formation projected into subject-review identity.
 *
 * Formations are not part of the structural-description vocabulary: treating a
 * bounded formation runtime as an instance set would erase its slot, hero,
 * formation-motion, and LOD semantics. Subject review therefore carries the
 * compiler-owned formation record directly while sharing only identity,
 * revision, kind, and bounded member summary with other subject descriptions.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity Keeps a formation reviewable under its own identity without expanding every anonymous member.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record Types the compact formation record as a subject without misclassifying it as an instance set.
 * @author Samchon
 */
export interface IAutoMovieFormationSubjectReviewDescription {
  /** Revision of the compiled shot artifact that owns the formation. */
  revision: string;
  /** Stable namespaced formation subject id. */
  id: string;
  /** Subject role kept distinct from structural-description kinds. */
  kind: "formation";
  /** Exact compiler-owned compact formation runtime. */
  formation: IAutoMovieCompiledFormation;
  /** Exact member count with a bounded sample of named hero slots. */
  members: IAutoMovieSubjectMemberSummary;
}

/**
 * Compiled description accepted by the subject-review unit.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity Combines structural subjects with the independently compiled formation kind acceptance may name.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record Preserves the different source records instead of forcing one into the other's vocabulary.
 * @author Samchon
 */
export type AutoMovieSubjectReviewDescription =
  | IAutoMovieSubjectDescription
  | IAutoMovieFormationSubjectReviewDescription;

/**
 * Resolved review unit for one compiled subject.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-inspection Makes a subject rather than a film moment the unit being reviewed.
 * @evidence requirements/review/subject-inspection.md#review-subject-identity Carries the stable compiled description without collapsing prototype and placement identities.
 * @evidence requirements/review/subject-inspection.md#review-observable-judgeable-parity Types the independent observation unit exposed for every supported subject target.
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Records that viewpoint authority belongs to inspection and cannot produce delivery evidence.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record Types the resolved subject record used by review.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity Gives a resolved subject target its own observation unit.
 * @evidencePart specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity::subject-target-parity
 * @author Samchon
 */
export interface IAutoMovieSubjectReviewUnit {
  /** Subject-review protocol version. */
  version: 1;
  /** Exact target used to locate the compiled subject. */
  target: IAutoMovieSubjectReviewTarget;
  /** Compiled description and revision that define the unit. */
  description: AutoMovieSubjectReviewDescription;
  /** Viewpoint authority, fixed to the inspection rather than the work. */
  viewpointOwner: "inspection";
  /** Subject observations are never eligible as delivery-frame evidence. */
  deliveryEvidenceEligible: false;
}

/**
 * Result of comparing required subject viewpoints with current observations.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-coverage Separates planned, observed and missing subject-view coverage.
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Distinguishes current, stale, partial, not-run and indeterminate evidence states.
 * @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange Reports foreign evidence without counting it toward subject coverage.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-coverage Types the explicit numerator, denominator, omissions and duplicate accounting of one subject review.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Carries stale viewpoint identities separately from current coverage.
 * @evidencePart specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness::subject-freshness
 * @evidence specifications/review-and-acceptance/target-scope-and-context.md#review-system-context-unavailable Represents missing, stale, partial, not-run, and indeterminate subject context without converting it into a passing observation.
 * @evidencePart specifications/review-and-acceptance/target-scope-and-context.md#review-system-context-unavailable::context-unavailable-state
 * @author Samchon
 */
export interface IAutoMovieSubjectReviewCoverage {
  /** Derived execution state for this subject and plan. */
  state: "indeterminate" | "not-run" | "partial" | "stale" | "reviewed";
  /** Required viewpoint ids in declared plan order. */
  planned: string[];
  /** Required viewpoint ids covered at the current subject revision. */
  observed: string[];
  /** Required viewpoint ids with no current observation. */
  missing: string[];
  /** Required viewpoint ids observed only at another revision. */
  stale: string[];
  /** Extra current observations for a viewpoint outside the plan. */
  unplanned: string[];
  /** Records for another subject or another evidence kind. */
  foreign: number;
  /** Redundant current records beyond the first record per viewpoint. */
  duplicates: number;
}
