import {
  AutoMovieContentDigest,
  AutoMovieRepaintObservationVerdict,
  IAutoMovieRepaintObservationMember,
  IAutoMovieRepaintSequenceObservation,
} from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";

export type {
  AutoMovieRepaintObservationVerdict,
  IAutoMovieRepaintObservationMember,
  IAutoMovieRepaintSequenceObservation,
} from "@automovie/interface";

/**
 * Stable aggregate-observation refusal classes.
 *
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-publication-gate Distinguishes malformed, stale-set, stale-basis, and incomplete observations.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-structure-continuity Lets finalization refuse the exact failed aggregate invariant.
 */
export type AutoMovieRepaintObservationDiagnostic =
  | "observation-schema-invalid"
  | "observation-member-set-stale"
  | "observation-basis-stale"
  | "observation-artifact-stale"
  | "observation-incomplete";

/**
 * Digest the ordered active visual set observed during sequence playback.
 *
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-temporal-artifacts Seals the exact ordered current selection population that a reviewer played.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-structure-continuity Prevents a per-shot review from standing in for aggregate sequence observation.
 */
export const digestAutoMovieRepaintObservationMembers = (
  members: readonly IAutoMovieRepaintObservationMember[],
): AutoMovieContentDigest => {
  assertMembers(members);
  return digestAutoMovieBytes(canonicalAutoMovieJsonBytes(members));
};

/**
 * Verify one persisted sequence observation against the current timeline set.
 *
 * @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-publication-gate Refuses publication when any selection, timeline, baseline, playback artifact, or verdict is not the one currently reviewed.
 * @evidence specifications/asset-and-representation/generated-assets-and-repaint-handoff.md#asset-spec-repaint-structure-continuity Preserves failed and incomplete observations while granting publication only to one current completed five-pass observation.
 */
export const autoMovieRepaintSequenceObservationDiagnostics = (props: {
  observation: IAutoMovieRepaintSequenceObservation;
  productionId: string;
  compileFingerprint: AutoMovieContentDigest;
  timelineFingerprint: AutoMovieContentDigest;
  baseline: IAutoMovieRepaintSequenceObservation["baseline"];
  members: readonly IAutoMovieRepaintObservationMember[];
  artifactDigest: AutoMovieContentDigest | null;
}): AutoMovieRepaintObservationDiagnostic[] => {
  const diagnostics: AutoMovieRepaintObservationDiagnostic[] = [];
  try {
    assertObservation(props.observation);
    assertMembers(props.members);
    assertBaseline(props.baseline);
    if (
      !isExactText(props.productionId) ||
      !isDigest(props.compileFingerprint) ||
      !isDigest(props.timelineFingerprint)
    )
      throw new Error("Current repaint observation basis is malformed.");
  } catch {
    return ["observation-schema-invalid"];
  }
  if (
    props.observation.memberSetDigest !==
      digestAutoMovieRepaintObservationMembers(props.members) ||
    canonical(props.observation.members) !== canonical(props.members)
  )
    diagnostics.push("observation-member-set-stale");
  if (
    props.observation.productionId !== props.productionId ||
    props.observation.compileFingerprint !== props.compileFingerprint ||
    props.observation.timelineFingerprint !== props.timelineFingerprint ||
    canonical(props.observation.baseline) !== canonical(props.baseline)
  )
    diagnostics.push("observation-basis-stale");
  if (props.artifactDigest !== props.observation.artifact.digest)
    diagnostics.push("observation-artifact-stale");
  if (
    props.observation.status !== "completed" ||
    Object.values(props.observation.verdicts).some(
      (verdict) => verdict !== "pass",
    )
  )
    diagnostics.push("observation-incomplete");
  return diagnostics;
};

const assertObservation = (
  observation: IAutoMovieRepaintSequenceObservation,
): void => {
  if (
    observation.version !== 1 ||
    [
      observation.productionId,
      observation.baseline.address,
      observation.baseline.version,
      observation.artifact.path,
      observation.playback.runtime,
      observation.playback.context,
    ].some((value) => !isExactText(value)) ||
    [
      observation.compileFingerprint,
      observation.timelineFingerprint,
      observation.memberSetDigest,
      observation.artifact.digest,
    ].some((digest) => !isDigest(digest)) ||
    !isStatus(observation.status) ||
    Object.values(observation.verdicts).length !== 5 ||
    Object.values(observation.verdicts).some((verdict) => !isVerdict(verdict))
  )
    throw new Error("Repaint sequence observation is malformed.");
  assertBaseline(observation.baseline);
  assertMembers(observation.members);
  if (
    observation.memberSetDigest !==
    digestAutoMovieRepaintObservationMembers(observation.members)
  )
    throw new Error("Repaint sequence observation member digest is malformed.");
};

const assertMembers = (
  members: readonly IAutoMovieRepaintObservationMember[],
): void => {
  if (members.length === 0)
    throw new Error("Repaint sequence observation requires a film member.");
  const occurrences = new Set<string>();
  for (const member of members) {
    if (
      !isExactText(member.occurrence) ||
      !isExactText(member.shot) ||
      occurrences.has(member.occurrence) ||
      (member.lane !== "deterministic" && member.lane !== "repainted") ||
      (member.lane === "deterministic"
        ? !isDigest(member.sourceDigest)
        : !isExactText(member.requestId) ||
          !isExactText(member.attemptId) ||
          !isDigest(member.outputDigest) ||
          !isDigest(member.candidateReceiptDigest) ||
          !isExactText(member.selectionId) ||
          !isDigest(member.selectionDigest))
    )
      throw new Error("Repaint sequence observation member is malformed.");
    occurrences.add(member.occurrence);
  }
};

const assertBaseline = (
  baseline: IAutoMovieRepaintSequenceObservation["baseline"],
): void => {
  if (
    !isExactText(baseline.address) ||
    !isExactText(baseline.version) ||
    baseline.scope.length === 0 ||
    baseline.scope.some((value) => !isExactText(value)) ||
    new Set(baseline.scope).size !== baseline.scope.length ||
    baseline.intendedDeltas.some((value) => !isExactText(value)) ||
    new Set(baseline.intendedDeltas).size !== baseline.intendedDeltas.length
  )
    throw new Error("Repaint sequence observation baseline is malformed.");
};

const canonical = (value: unknown): string =>
  Buffer.from(canonicalAutoMovieJsonBytes(value)).toString("utf8");
const isDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/u.test(value);
const isExactText = (value: string): boolean =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();
const isStatus = (
  value: IAutoMovieRepaintSequenceObservation["status"],
): boolean =>
  value === "completed" ||
  value === "failed" ||
  value === "not-run" ||
  value === "unsupported";
const isVerdict = (value: AutoMovieRepaintObservationVerdict): boolean =>
  value === "pass" ||
  value === "fail" ||
  value === "not-run" ||
  value === "unsupported";
