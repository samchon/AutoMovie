import {
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
  viewpoints: readonly IAutoMovieSubjectReviewViewpoint[],
  observations: readonly unknown[],
): IAutoMovieSubjectReviewCoverage => {
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
      !isSubjectObservation(candidate) ||
      candidate.subject !== unit.description.id
    ) {
      ++foreign;
      continue;
    }
    if (!plannedSet.has(candidate.viewpoint)) {
      if (candidate.revision === unit.description.revision)
        unplannedSet.add(candidate.viewpoint);
      else ++foreign;
      continue;
    }
    if (candidate.revision !== unit.description.revision) {
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

const isSubjectObservation = (
  value: unknown,
): value is IAutoMovieSubjectReviewObservation => {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return false;
  const record = value as Record<string, unknown>;
  return (
    record.kind === "subject-view" &&
    nonBlank(record.subject) &&
    nonBlank(record.revision) &&
    nonBlank(record.viewpoint) &&
    nonBlank(record.artifact) &&
    nonBlank(record.digest)
  );
};

const nonBlank = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length !== 0;

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
