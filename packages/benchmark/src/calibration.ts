import {
  IAutoMovieBenchmarkVerdict,
  judgeAutoMovieBenchmarkSubmission,
} from "./judge";
import { IAutoMovieBenchmarkSubmission } from "./submission";
import {
  IAutoMovieBenchmarkBand,
  IAutoMovieBenchmarkTask,
  compareBenchmarkCodeUnits,
} from "./task";

/** One known-broken submission bound to the mutant band it must land in. */
export interface IAutoMovieBenchmarkMutantAnchor {
  /** Mutant id declared by the task's calibration. */
  id: string;
  /** Sealed submission carrying the fixed defect. */
  submission: IAutoMovieBenchmarkSubmission;
}

/** The anchors that pin one judge in place. */
export interface IAutoMovieBenchmarkAnchors {
  /** The intended vertical slice. */
  reference: IAutoMovieBenchmarkSubmission;
  /** A bootstrap-only submission with no film in it. */
  empty: IAutoMovieBenchmarkSubmission;
  /** Every known-broken submission. */
  mutants: IAutoMovieBenchmarkMutantAnchor[];
}

/** Where one anchor landed against the band its task fixes. */
export interface IAutoMovieBenchmarkCalibrationResult {
  /** Anchor label: `reference`, `empty`, or `mutant:<id>`. */
  anchor: string;
  /** Band the task fixes for the anchor. */
  band: IAutoMovieBenchmarkBand;
  /** Film score, or `null` when the anchor did not reach a scored verdict. */
  filmScore: number | null;
  /** Verdict taxonomy outcome the anchor reached. */
  outcome: IAutoMovieBenchmarkVerdict["outcome"];
  /** Whether the anchor landed inside its band. */
  inside: boolean;
}

/**
 * Score every anchor against the bands its task fixes.
 *
 * Anchors are the only part of a benchmark that measures the judge instead of a
 * candidate. Both endpoints matter and so does the middle: a refactor that
 * promotes a known-broken submission, or one that quietly drops the intended
 * slice, changes a mutant band long before it changes a leaderboard anyone
 * reads.
 */
export const calibrateAutoMovieBenchmark = (
  task: IAutoMovieBenchmarkTask,
  anchors: IAutoMovieBenchmarkAnchors,
): IAutoMovieBenchmarkCalibrationResult[] => {
  const declared = task.calibration.mutants
    .map((mutant) => mutant.id)
    .sort(compareBenchmarkCodeUnits);
  const supplied = anchors.mutants
    .map((mutant) => mutant.id)
    .sort(compareBenchmarkCodeUnits);
  if (declared.join("\n") !== supplied.join("\n"))
    throw new Error(
      `Benchmark task "${task.taskId}" declares mutants [${declared.join(", ")}] but the anchors supply [${supplied.join(", ")}]. Every declared mutant needs a fixed submission.`,
    );
  const measure = (
    anchor: string,
    band: IAutoMovieBenchmarkBand,
    submission: IAutoMovieBenchmarkSubmission,
  ): IAutoMovieBenchmarkCalibrationResult => {
    const verdict = judgeAutoMovieBenchmarkSubmission(task, submission);
    const filmScore = verdict.filmScore;
    return {
      anchor,
      band,
      filmScore,
      outcome: verdict.outcome,
      inside:
        filmScore !== null &&
        filmScore >= band.min - 1e-9 &&
        filmScore <= band.max + 1e-9,
    };
  };
  return [
    measure("reference", task.calibration.reference, anchors.reference),
    measure("empty", task.calibration.empty, anchors.empty),
    ...task.calibration.mutants.map((mutant) =>
      measure(
        `mutant:${mutant.id}`,
        mutant.band,
        anchors.mutants.find((anchor) => anchor.id === mutant.id)!.submission,
      ),
    ),
  ];
};

/**
 * Refuse a judge whose anchors moved, naming every anchor that left its band.
 *
 * This is the assertion a continuous-integration lane runs, so it reports all
 * drifted anchors at once rather than the first: a refactor usually moves
 * several, and fixing them one failure at a time hides the shape of the
 * change.
 */
export const assertAutoMovieBenchmarkCalibrated = (
  task: IAutoMovieBenchmarkTask,
  anchors: IAutoMovieBenchmarkAnchors,
): IAutoMovieBenchmarkCalibrationResult[] => {
  const results = calibrateAutoMovieBenchmark(task, anchors);
  const drifted = results.filter((result) => result.inside === false);
  if (drifted.length !== 0)
    throw new Error(
      `Benchmark task "${task.taskId}" is out of calibration: ${drifted
        .map(
          (result) =>
            `${result.anchor} scored ${result.filmScore === null ? result.outcome : result.filmScore.toFixed(4)} outside ${result.band.min}..${result.band.max}`,
        )
        .join("; ")}.`,
    );
  return results;
};
