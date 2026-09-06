import {
  IAutoMovieRepaintSequenceObservation,
  autoMovieRepaintSequenceObservationDiagnostics,
  digestAutoMovieRepaintObservationMembers,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";

const digest = (character: string) => `sha256:${character.repeat(64)}` as const;

/**
 * Sequence review is bound to the exact current active visual set.
 *
 * Scenarios:
 *
 * 1. A current two-shot mixed set and a one-shot set pass with five completed
 *    verdicts.
 * 2. Replacing one selection, changing the compile/baseline, or retaining a
 *    failed verdict produces its independent stale or incomplete refusal.
 * 3. A malformed observation, member set, baseline, or current basis is one
 *    schema refusal rather than a stale or incomplete verdict, and every
 *    non-passing status or verdict vocabulary member is admitted as incomplete
 *    rather than refused.
 */
export const test_production_repaint_sequence_observation = (): void => {
  const members = [
    {
      occurrence: "occurrence-1",
      shot: "a",
      lane: "deterministic" as const,
      sourceDigest: digest("1"),
    },
    {
      occurrence: "occurrence-2",
      shot: "b",
      lane: "repainted" as const,
      requestId: "request-b",
      attemptId: "attempt-b",
      outputDigest: digest("2"),
      candidateReceiptDigest: digest("3"),
      selectionId: "selection-b",
      selectionDigest: digest("4"),
    },
  ];
  const baseline = {
    address: "docs/continuity.md#baseline",
    version: "v1",
    scope: ["film"],
    intendedDeltas: ["shot-b appearance"],
  };
  const observation: IAutoMovieRepaintSequenceObservation = {
    version: 1,
    productionId: "film",
    compileFingerprint: digest("5"),
    timelineFingerprint: digest("6"),
    baseline,
    members,
    memberSetDigest: digestAutoMovieRepaintObservationMembers(members),
    artifact: { path: "review/sequence.mp4", digest: digest("7") },
    playback: { runtime: "chromium@1", context: "final-raster" },
    status: "completed",
    verdicts: {
      flicker: "pass",
      identityDrift: "pass",
      geometryWarp: "pass",
      textureCrawl: "pass",
      transitionMismatch: "pass",
    },
  };
  const diagnose = (
    current: Partial<{
      observation: IAutoMovieRepaintSequenceObservation;
      compileFingerprint: typeof observation.compileFingerprint;
      baseline: typeof baseline;
      members: typeof members;
      artifactDigest: typeof observation.artifact.digest;
    }> = {},
  ) =>
    autoMovieRepaintSequenceObservationDiagnostics({
      observation: current.observation ?? observation,
      productionId: "film",
      compileFingerprint:
        current.compileFingerprint ?? observation.compileFingerprint,
      timelineFingerprint: observation.timelineFingerprint,
      baseline: current.baseline ?? baseline,
      members: current.members ?? members,
      artifactDigest: current.artifactDigest ?? observation.artifact.digest,
    });
  const replaced = structuredClone(members);
  replaced[1]!.selectionId = "selection-b2";
  replaced[1]!.selectionDigest = digest("8");
  const failed = structuredClone(observation);
  failed.status = "failed";
  failed.verdicts.transitionMismatch = "fail";
  TestValidator.equals(
    "selection set, basis and failed truth remain independent publication facts",
    {
      current: diagnose(),
      replaced: diagnose({ members: replaced }),
      compile: diagnose({ compileFingerprint: digest("9") }),
      baseline: diagnose({
        baseline: { ...baseline, version: "v2" },
      }),
      artifact: diagnose({ artifactDigest: digest("9") }),
      failed: diagnose({ observation: failed }),
      oneShot: autoMovieRepaintSequenceObservationDiagnostics({
        observation: {
          ...observation,
          members: [members[0]!],
          memberSetDigest: digestAutoMovieRepaintObservationMembers([
            members[0]!,
          ]),
        },
        productionId: "film",
        compileFingerprint: observation.compileFingerprint,
        timelineFingerprint: observation.timelineFingerprint,
        baseline,
        members: [members[0]!],
        artifactDigest: observation.artifact.digest,
      }),
    },
    {
      current: [],
      replaced: ["observation-member-set-stale"],
      compile: ["observation-basis-stale"],
      baseline: ["observation-basis-stale"],
      artifact: ["observation-artifact-stale"],
      failed: ["observation-incomplete"],
      oneShot: [],
    },
  );

  const withStatus = (
    status: IAutoMovieRepaintSequenceObservation["status"],
    verdict: IAutoMovieRepaintSequenceObservation["verdicts"]["flicker"],
  ): IAutoMovieRepaintSequenceObservation => ({
    ...observation,
    status,
    verdicts: { ...observation.verdicts, flicker: verdict },
  });
  const blankOccurrence = structuredClone(members);
  blankOccurrence[0]!.occurrence = " ";
  const digestThrows = (task: () => unknown): boolean => {
    try {
      task();
      return false;
    } catch {
      return true;
    }
  };
  TestValidator.equals(
    "malformed records are one schema refusal and every vocabulary member is admitted",
    {
      foreignVersion: diagnose({
        observation: { ...observation, version: 2 as 1 },
      }),
      staleMemberDigest: diagnose({
        observation: { ...observation, memberSetDigest: digest("a") },
      }),
      emptyMembers: diagnose({
        observation: {
          ...observation,
          members: [],
          memberSetDigest: digest("b"),
        },
      }),
      blankMemberOccurrence: diagnose({ members: blankOccurrence }),
      repeatedBaselineDelta: diagnose({
        baseline: { ...baseline, intendedDeltas: ["same", "same"] },
      }),
      blankBasis: autoMovieRepaintSequenceObservationDiagnostics({
        observation,
        productionId: " ",
        compileFingerprint: observation.compileFingerprint,
        timelineFingerprint: observation.timelineFingerprint,
        baseline,
        members,
        artifactDigest: observation.artifact.digest,
      }),
      notRun: diagnose({ observation: withStatus("not-run", "not-run") }),
      unsupported: diagnose({
        observation: withStatus("unsupported", "unsupported"),
      }),
      failedVerdictAlone: diagnose({
        observation: withStatus("completed", "fail"),
      }),
      emptyMemberDigestRefused: digestThrows(() =>
        digestAutoMovieRepaintObservationMembers([]),
      ),
    },
    {
      foreignVersion: ["observation-schema-invalid"],
      staleMemberDigest: ["observation-schema-invalid"],
      emptyMembers: ["observation-schema-invalid"],
      blankMemberOccurrence: ["observation-schema-invalid"],
      repeatedBaselineDelta: ["observation-schema-invalid"],
      blankBasis: ["observation-schema-invalid"],
      notRun: ["observation-incomplete"],
      unsupported: ["observation-incomplete"],
      failedVerdictAlone: ["observation-incomplete"],
      emptyMemberDigestRefused: true,
    },
  );
};
