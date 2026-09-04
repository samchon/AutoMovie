import { AutoMovieContentDigest } from "@automovie/interface";

import {
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
} from "./contentIdentity";

/** Exact timeline occurrence represented by an aggregate repaint observation. */
export type IAutoMovieRepaintObservationMember =
  | {
      occurrence: string;
      shot: string;
      lane: "deterministic";
      sourceDigest: AutoMovieContentDigest;
    }
  | {
      occurrence: string;
      shot: string;
      lane: "repainted";
      requestId: string;
      attemptId: string;
      outputDigest: AutoMovieContentDigest;
      candidateReceiptDigest: AutoMovieContentDigest;
      selectionId: string;
      selectionDigest: AutoMovieContentDigest;
    };

/** Complete five-axis temporal verdict retained even when it is not passing. */
export type AutoMovieRepaintObservationVerdict =
  | "pass"
  | "fail"
  | "not-run"
  | "unsupported";

/** Versioned aggregate observation over one exact active visual set. */
export interface IAutoMovieRepaintSequenceObservation {
  version: 1;
  productionId: string;
  compileFingerprint: AutoMovieContentDigest;
  timelineFingerprint: AutoMovieContentDigest;
  baseline: {
    address: string;
    version: string;
    scope: string[];
    intendedDeltas: string[];
  };
  members: IAutoMovieRepaintObservationMember[];
  memberSetDigest: AutoMovieContentDigest;
  artifact: { path: string; digest: AutoMovieContentDigest };
  playback: { runtime: string; context: string };
  status: "completed" | "failed" | "not-run" | "unsupported";
  verdicts: {
    flicker: AutoMovieRepaintObservationVerdict;
    identityDrift: AutoMovieRepaintObservationVerdict;
    geometryWarp: AutoMovieRepaintObservationVerdict;
    textureCrawl: AutoMovieRepaintObservationVerdict;
    transitionMismatch: AutoMovieRepaintObservationVerdict;
  };
}

/** Stable aggregate-observation refusal classes. */
export type AutoMovieRepaintObservationDiagnostic =
  | "observation-schema-invalid"
  | "observation-member-set-stale"
  | "observation-basis-stale"
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
}): AutoMovieRepaintObservationDiagnostic[] => {
  const diagnostics: AutoMovieRepaintObservationDiagnostic[] = [];
  try {
    assertObservation(props.observation);
    assertMembers(props.members);
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
    observation.baseline.scope.some((value) => !isExactText(value)) ||
    new Set(observation.baseline.scope).size !==
      observation.baseline.scope.length ||
    observation.baseline.intendedDeltas.some((value) => !isExactText(value)) ||
    new Set(observation.baseline.intendedDeltas).size !==
      observation.baseline.intendedDeltas.length
  )
    throw new Error("Repaint sequence observation is malformed.");
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

const canonical = (value: unknown): string =>
  Buffer.from(canonicalAutoMovieJsonBytes(value)).toString("utf8");
const isDigest = (value: string): boolean =>
  /^sha256:[0-9a-f]{64}$/u.test(value);
const isExactText = (value: string): boolean =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();
