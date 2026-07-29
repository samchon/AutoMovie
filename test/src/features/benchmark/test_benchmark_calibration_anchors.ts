import {
  IAutoMovieBenchmarkAnchors,
  IAutoMovieBenchmarkSubmission,
  IAutoMovieBenchmarkTask,
  assertAutoMovieBenchmarkCalibrated,
  austerlitzSignalAnchors,
  austerlitzSignalDraft,
  austerlitzSignalTask,
  calibrateAutoMovieBenchmark,
  sealAutoMovieBenchmarkSubmission,
  validateAutoMovieBenchmarkTask,
} from "@automovie/benchmark";
import { TestValidator } from "@nestia/e2e";

const throws = (task: () => unknown, fragment: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

const bindSubmission = (
  task: IAutoMovieBenchmarkTask,
  submission: IAutoMovieBenchmarkSubmission,
): IAutoMovieBenchmarkSubmission => {
  const { runId: _runId, ...draft } = submission;
  void _runId;
  return sealAutoMovieBenchmarkSubmission({
    ...draft,
    taskDigest: validateAutoMovieBenchmarkTask(task),
  });
};

const bindAnchors = (
  task: IAutoMovieBenchmarkTask,
  anchors: IAutoMovieBenchmarkAnchors,
): IAutoMovieBenchmarkAnchors => ({
  reference: bindSubmission(task, anchors.reference),
  empty: bindSubmission(task, anchors.empty),
  mutants: anchors.mutants.map((mutant) => ({
    id: mutant.id,
    submission: bindSubmission(task, mutant.submission),
  })),
});

/**
 * Calibration measures the judge rather than any candidate, so both endpoints
 * and every known-broken middle are fixed before a leaderboard is read.
 *
 * Scenarios:
 *
 * 1. The shipped anchors all land inside the bands the corpus task fixes, and the
 *    reference, empty, and three mutant anchors are reported in that order with
 *    their taxonomy outcomes.
 * 2. A judge that promotes a known-broken submission is refused, and the refusal
 *    names the anchor, its score, and the band it left.
 * 3. An anchor that never reached a scored verdict has no score at all, so it
 *    cannot satisfy a band by accident.
 * 4. Anchors that do not supply exactly the declared mutant set are refused before
 *    anything is measured.
 */
export const test_benchmark_calibration_anchors = (): void => {
  const task = austerlitzSignalTask();
  const anchors = austerlitzSignalAnchors();
  const results = assertAutoMovieBenchmarkCalibrated(task, anchors);
  TestValidator.equals(
    "every shipped anchor lands inside its fixed band",
    results.map(
      (result) =>
        `${result.anchor}:${result.outcome}:${result.filmScore?.toFixed(4) ?? "none"}`,
    ),
    [
      "reference:scored:1.0000",
      "empty:gate-failed:0.0000",
      "mutant:stale-frame:scored:0.8750",
      "mutant:missing-formation:scored:0.9000",
      "mutant:broken-runtime:scored:0.9625",
    ],
  );

  const promotedTask: IAutoMovieBenchmarkTask = {
    ...task,
    calibration: {
      ...task.calibration,
      mutants: task.calibration.mutants.map((mutant) =>
        mutant.id === "stale-frame"
          ? { ...mutant, band: { min: 0.99, max: 1 } }
          : mutant,
      ),
    },
  };
  TestValidator.predicate(
    "a judge that promotes a known-broken submission is refused",
    throws(
      () =>
        assertAutoMovieBenchmarkCalibrated(
          promotedTask,
          bindAnchors(promotedTask, anchors),
        ),
      "mutant:stale-frame scored 0.8750 outside 0.99..1",
    ),
  );

  const excludedAnchors = {
    ...anchors,
    reference: sealAutoMovieBenchmarkSubmission({
      ...austerlitzSignalDraft("production"),
      incident: {
        kind: "harness-error" as const,
        gate: "capture-runtime" as const,
        detail: "The runner crashed mid-capture.",
      },
    }),
  };
  TestValidator.predicate(
    "an excluded anchor has no score to satisfy a band with",
    (() => {
      const excluded = calibrateAutoMovieBenchmark(task, excludedAnchors);
      return (
        excluded[0]!.filmScore === null &&
        excluded[0]!.outcome === "infra-excluded" &&
        excluded[0]!.inside === false
      );
    })(),
  );
  TestValidator.predicate(
    "an excluded anchor is reported by its outcome, not by a score it lacks",
    throws(
      () => assertAutoMovieBenchmarkCalibrated(task, excludedAnchors),
      "reference scored infra-excluded outside 0.995..1",
    ),
  );

  TestValidator.predicate(
    "anchors must supply exactly the declared mutant set",
    throws(
      () =>
        calibrateAutoMovieBenchmark(task, {
          ...anchors,
          mutants: anchors.mutants.slice(0, 2),
        }),
      "Every declared mutant needs a fixed submission",
    ),
  );
  const separatorTask: IAutoMovieBenchmarkTask = {
    ...task,
    calibration: {
      ...task.calibration,
      mutants: [
        {
          ...task.calibration.mutants[0]!,
          id: "ids\njoined",
        },
      ],
    },
  };
  TestValidator.predicate(
    "mutant ids containing the old join separator cannot disguise another set",
    throws(
      () =>
        calibrateAutoMovieBenchmark(separatorTask, {
          ...anchors,
          mutants: [
            { ...anchors.mutants[0]!, id: "ids" },
            { ...anchors.mutants[1]!, id: "joined" },
          ],
        }),
      "Every declared mutant needs a fixed submission",
    ),
  );

  const displacedEmptyTask: IAutoMovieBenchmarkTask = {
    ...task,
    calibration: { ...task.calibration, empty: { min: 0.5, max: 1 } },
  };
  TestValidator.predicate(
    "an anchor outside its band is reported without throwing",
    calibrateAutoMovieBenchmark(
      displacedEmptyTask,
      bindAnchors(displacedEmptyTask, anchors),
    )[1]!.inside === false,
  );
};
