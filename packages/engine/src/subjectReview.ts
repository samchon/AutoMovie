import {
  AutoMovieContentDigest,
  IAutoMovieSubjectArtifact,
  IAutoMovieSubjectReviewCoverage,
  IAutoMovieSubjectReviewObservation,
  IAutoMovieSubjectReviewTarget,
  IAutoMovieSubjectReviewUnit,
  IAutoMovieSubjectReviewViewpoint,
} from "@automovie/interface";

import { describeAutoMovieSubject } from "./subjectDescription";

/**
 * Resolve one subject-review unit from compiled truth.
 *
 * Subject identity and composition come from the shared subject-description
 * query. This resolver adds only review semantics: artifact qualification,
 * inspection-owned viewpoint authority, and delivery-evidence separation.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-identity Reuses the compiled subject identity rather than reconstructing it from names.
 * @evidence requirements/review/subject-inspection.md#review-observable-judgeable-parity Resolves every supported public subject target into its own observable review unit.
 * @evidence requirements/review/subject-inspection.md#review-subject-viewpoint-ownership Assigns viewpoint authority to inspection and excludes the result from delivery evidence.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-record Resolves the shared compiled description into one review record.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-target-parity Gives every resolvable compiled subject an independent review unit.
 */
export const resolveAutoMovieSubjectReviewUnit = (
  artifact: IAutoMovieSubjectArtifact,
  target: IAutoMovieSubjectReviewTarget,
): IAutoMovieSubjectReviewUnit => {
  const description = target.subject.startsWith("formation:")
    ? formationDescription(artifact, target.subject)
    : describeAutoMovieSubject(artifact, target.subject);
  return {
    version: 1,
    target,
    description,
    viewpointOwner: "inspection",
    deliveryEvidenceEligible: false,
  };
};

const formationDescription = (
  artifact: IAutoMovieSubjectArtifact,
  subject: string,
): Extract<
  IAutoMovieSubjectReviewUnit["description"],
  { kind: "formation" }
> => {
  const id = subject.slice("formation:".length);
  const formation = artifact.compiled.formations.find(
    (candidate) => candidate.id === id,
  );
  if (formation === undefined)
    throw new Error(
      `Compiled subject "${subject}" does not exist in revision "${artifact.revision}".`,
    );
  const heroes = formation.heroes
    .map((hero) => `formation-slot:${formation.id}:${hero.slot}`)
    .sort(compareCodeUnits);
  return {
    revision: artifact.revision,
    id: subject,
    kind: "formation",
    formation,
    members: {
      total: formation.count,
      offset: 0,
      items: heroes,
      omitted: formation.count - heroes.length,
    },
  };
};

/**
 * Fold planned subject viewpoints against current observation receipts.
 *
 * The function accepts unknown records at the evidence boundary so a frame
 * receipt, malformed payload, or another subject can be counted as foreign
 * without being cast into subject coverage. Plan order is authoritative and
 * preserved; unrelated input order cannot change the result.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Refuses stale, malformed and wrong-subject receipts as current subject evidence.
 * @evidence requirements/review/subject-inspection.md#review-subject-coverage Separates the declared viewpoint denominator from current, missing and stale observations.
 * @evidence requirements/review/subject-inspection.md#review-subject-time-noninterchange Prevents frame-shaped evidence from satisfying a subject obligation.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-observation Admits only receipt-shaped subject observations bound to this identity and revision.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Makes a changed compiled revision stale without treating a shot rerender as renewal.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-coverage Computes deterministic planned, actual and missing coverage without duplicate inflation.
 */
export const foldAutoMovieSubjectReviewCoverage = (
  unit: IAutoMovieSubjectReviewUnit,
  current: IAutoMovieSubjectReviewCurrentContext,
  viewpoints: readonly IAutoMovieSubjectReviewViewpoint[],
  observations: readonly unknown[],
): IAutoMovieSubjectReviewCoverage => {
  validateCurrentContext(unit, current);
  validateViewpointPlan(viewpoints);
  const planned = viewpoints.map((viewpoint) => viewpoint.id);
  const plannedSet = new Set(planned);
  const observedSet = new Set<string>();
  const staleSet = new Set<string>();
  const unplannedSet = new Set<string>();
  let foreign = 0;
  let duplicates = 0;
  for (const candidate of observations) {
    if (
      !isCurrentSubjectObservation(candidate) ||
      candidate.productionId !== current.productionId ||
      candidate.subject !== unit.description.id ||
      candidate.target.shot !== current.target.shot ||
      candidate.target.subject !== current.target.subject
    ) {
      ++foreign;
      continue;
    }
    if (!plannedSet.has(candidate.viewpoint)) {
      if (isCurrentObservationContext(candidate, current))
        unplannedSet.add(candidate.viewpoint);
      else ++foreign;
      continue;
    }
    if (!isCurrentObservationContext(candidate, current)) {
      staleSet.add(candidate.viewpoint);
      continue;
    }
    if (observedSet.has(candidate.viewpoint)) ++duplicates;
    else observedSet.add(candidate.viewpoint);
  }
  const observed = planned.filter((id) => observedSet.has(id));
  const missing = planned.filter((id) => !observedSet.has(id));
  const stale = planned.filter(
    (id) => staleSet.has(id) && !observedSet.has(id),
  );
  return {
    state:
      planned.length === 0
        ? "indeterminate"
        : observed.length === planned.length
          ? "reviewed"
          : observed.length !== 0
            ? "partial"
            : stale.length !== 0
              ? "stale"
              : "not-run",
    planned,
    observed,
    missing,
    stale,
    unplanned: [...unplannedSet].sort(compareCodeUnits),
    foreign,
    duplicates,
  };
};

const validateCurrentContext = (
  unit: IAutoMovieSubjectReviewUnit,
  current: IAutoMovieSubjectReviewCurrentContext,
): void => {
  if (
    current.productionId.trim().length === 0 ||
    current.target.shot.trim().length === 0 ||
    current.target.subject !== unit.description.id ||
    current.target.shot !== unit.target.shot ||
    current.revision !== unit.description.revision ||
    /^sha256:[0-9a-f]{64}$/u.test(current.compileFingerprint) === false ||
    /^sha256:[0-9a-f]{64}$/u.test(current.planIdentity) === false ||
    current.captureRuntimeIdentity.trim().length === 0
  )
    throw new Error(
      "Subject review current context must exactly name the resolved unit, current compile, ordered plan, and canonical runtime.",
    );
};

/**
 * Exact current context against which verified subject observations are folded.
 *
 * Runtime identity is the canonical capture-runtime JSON, not a weaker local
 * fingerprint. Production owns its schema validation and hands the fold only a
 * receipt whose artifact, pose and runtime have already been reopened.
 *
 * @evidence requirements/review/subject-inspection.md#review-subject-evidence Binds coverage to the production, target, compile, plan and current runtime that produced the reopened artifact.
 * @evidence specifications/review-and-acceptance/subject-surface-and-inspection.md#review-system-subject-freshness Makes every changed current-context member stale rather than silently current.
 */
export interface IAutoMovieSubjectReviewCurrentContext {
  /** Production namespace that owns the inspection. */
  productionId: string;
  /** Exact artifact-qualified subject target. */
  target: IAutoMovieSubjectReviewTarget;
  /** Exact compiled subject revision. */
  revision: string;
  /** Current source compile identity. */
  compileFingerprint: AutoMovieContentDigest;
  /** Canonical ordered whole-plan identity. */
  planIdentity: AutoMovieContentDigest;
  /** Canonical complete capture-runtime identity JSON. */
  captureRuntimeIdentity: string;
}

/**
 * Production-verified observation admitted at the engine boundary.
 *
 * The production verifier creates this projection only after checking the
 * exact persisted schema, pose, owned artifact bytes and terminal verdict.
 */
export interface IAutoMovieCurrentSubjectReviewObservation
  extends
    IAutoMovieSubjectReviewObservation,
    IAutoMovieSubjectReviewCurrentContext {
  /** Exact target repeated on the receipt for an independent context join. */
  target: IAutoMovieSubjectReviewTarget;
  /** Only a terminal pass can enter the coverage numerator. */
  verdict: "passed";
}

const validateViewpointPlan = (
  viewpoints: readonly IAutoMovieSubjectReviewViewpoint[],
): void => {
  const ids = new Set<string>();
  for (const viewpoint of viewpoints) {
    if (viewpoint.id.trim().length === 0)
      throw new RangeError("Subject review viewpoint id must not be blank.");
    if (ids.has(viewpoint.id))
      throw new RangeError(
        `Subject review viewpoint id "${viewpoint.id}" is duplicated.`,
      );
    ids.add(viewpoint.id);
    if (!Number.isFinite(viewpoint.distance) || viewpoint.distance <= 0)
      throw new RangeError(
        `Subject review viewpoint "${viewpoint.id}" distance must be finite and positive.`,
      );
    const direction = viewpoint.direction;
    const length = Math.hypot(direction.x, direction.y, direction.z);
    if (!Number.isFinite(length) || Math.abs(length - 1) > 1e-6)
      throw new RangeError(
        `Subject review viewpoint "${viewpoint.id}" direction must be a finite unit vector.`,
      );
  }
};

const isCurrentSubjectObservation = (
  value: unknown,
): value is IAutoMovieCurrentSubjectReviewObservation => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === "subject-view" &&
    nonBlank(record.subject) &&
    nonBlank(record.revision) &&
    nonBlank(record.viewpoint) &&
    nonBlank(record.artifact) &&
    nonBlank(record.digest) &&
    nonBlank(record.productionId) &&
    isTarget(record.target) &&
    nonBlank(record.compileFingerprint) &&
    nonBlank(record.planIdentity) &&
    nonBlank(record.captureRuntimeIdentity) &&
    record.verdict === "passed"
  );
};

const isCurrentObservationContext = (
  observation: IAutoMovieCurrentSubjectReviewObservation,
  current: IAutoMovieSubjectReviewCurrentContext,
): boolean =>
  observation.revision === current.revision &&
  observation.compileFingerprint === current.compileFingerprint &&
  observation.planIdentity === current.planIdentity &&
  observation.captureRuntimeIdentity === current.captureRuntimeIdentity;

const isTarget = (value: unknown): value is IAutoMovieSubjectReviewTarget => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return nonBlank(record.shot) && nonBlank(record.subject);
};

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length !== 0;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
