import {
  IAutoMovieBenchmarkRubricVerdict,
  austerlitzSignalDraft,
  austerlitzSignalDryRun,
  austerlitzSignalTask,
  diffAutoMovieBenchmarkVerdicts,
  digestBenchmarkValue,
  judgeAutoMovieBenchmarkSubmission,
  reportAutoMovieBenchmark,
  sealAutoMovieBenchmarkSubmission,
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

/**
 * A benchmark report carries measured film outcomes and candidate generation
 * health side by side without ever blending them into one number, and a verdict
 * diff reports law drift before any score.
 *
 * Scenarios:
 *
 * 1. One dry evaluation of the same task law across the production and legacy
 *    surfaces reports each surface separately, with the legacy run's lower
 *    score and higher friction both visible.
 * 2. Infrastructure failures leave the denominator, so a rate-limited run neither
 *    lowers nor raises the surface it belonged to.
 * 3. A surface whose every run was excluded reports an empty denominator and no
 *    means at all rather than zeros.
 * 4. A rubric verdict without an evidence address, or outside the rubric range, is
 *    refused; a complete one rides beside the measured axes.
 * 5. A diff across drifted versions withholds the score delta entirely, while a
 *    diff under one law reports every assertion whose outcome moved, including
 *    assertions only one of the two verdicts settled.
 */
export const test_benchmark_surface_report = (): void => {
  const task = austerlitzSignalTask();
  const [production, legacy] = austerlitzSignalDryRun();
  const productionVerdict = judgeAutoMovieBenchmarkSubmission(
    task,
    production!,
  );
  const legacyVerdict = judgeAutoMovieBenchmarkSubmission(task, legacy!);
  const excluded = judgeAutoMovieBenchmarkSubmission(
    task,
    sealAutoMovieBenchmarkSubmission({
      ...austerlitzSignalDraft("legacy-compact"),
      incident: {
        kind: "account-limit",
        gate: "deliverable-render",
        detail: "The account ran out of budget.",
      },
    }),
  );

  const report = reportAutoMovieBenchmark([
    productionVerdict,
    legacyVerdict,
    excluded,
  ]);
  TestValidator.equals(
    "each surface is reported separately, in code-unit order",
    report.surfaces.map(
      (surface) =>
        `${surface.surface}:${surface.scored}/${surface.gateFailed}/${surface.infraExcluded}:${surface.denominator}`,
    ),
    ["legacy-compact:1/0/1:1", "production:1/0/0:1"],
  );
  TestValidator.equals(
    "the legacy run's lower score and higher friction are both visible",
    [
      report.surfaces[0]!.meanFilmScore?.toFixed(4),
      report.surfaces[0]!.meanCorrections,
      report.surfaces[1]!.meanFilmScore?.toFixed(4),
      report.surfaces[1]!.meanCorrections,
    ],
    ["0.9000", 9, "1.0000", 2],
  );
  TestValidator.equals(
    "the excluded run changes neither the score nor the friction it left",
    [report.surfaces[0]!.meanCostUsd, report.surfaces[0]!.meanElapsedSeconds],
    [19.4, 3_102],
  );

  const onlyExcluded = reportAutoMovieBenchmark([excluded]);
  TestValidator.equals(
    "a surface with an empty denominator reports no means at all",
    [
      onlyExcluded.surfaces[0]!.denominator,
      onlyExcluded.surfaces[0]!.meanFilmScore,
      onlyExcluded.surfaces[0]!.meanCostUsd,
      onlyExcluded.surfaces[0]!.meanElapsedSeconds,
      onlyExcluded.surfaces[0]!.meanCorrections,
    ],
    [0, null, null, null, null],
  );

  const rubric: IAutoMovieBenchmarkRubricVerdict = {
    runId: production!.runId,
    axis: "narrative",
    reviewer: "campaign-lead",
    score: 0.8,
    rationale: "The signal reads as a decision rather than a gesture.",
    evidence: ["frame:opening@2:beauty", "source:src/shots/opening.ts"],
  };
  TestValidator.predicate(
    "a rubric verdict that reads like a measurement is refused",
    throws(
      () =>
        reportAutoMovieBenchmark(
          [productionVerdict],
          [{ ...rubric, evidence: [] }],
        ),
      "carries no evidence address",
    ) &&
      throws(
        () =>
          reportAutoMovieBenchmark(
            [productionVerdict],
            [{ ...rubric, score: 2 }],
          ),
        "outside the 0..1 rubric range",
      ) &&
      throws(
        () =>
          reportAutoMovieBenchmark(
            [productionVerdict],
            [{ ...rubric, score: -0.1 }],
          ),
        "outside the 0..1 rubric range",
      ) &&
      throws(
        () =>
          reportAutoMovieBenchmark(
            [productionVerdict],
            [{ ...rubric, score: Number.NaN }],
          ),
        "outside the 0..1 rubric range",
      ),
  );
  TestValidator.equals(
    "a complete rubric verdict rides beside the measured axes",
    reportAutoMovieBenchmark([productionVerdict], [rubric]).rubric,
    [rubric],
  );

  TestValidator.equals(
    "a diff across drifted versions withholds the score delta",
    diffAutoMovieBenchmarkVerdicts(productionVerdict, {
      ...legacyVerdict,
      versions: { ...legacyVerdict.versions, harness: "2.0.0" },
    }),
    {
      versionDrift: ["harness: 1.0.0 -> 2.0.0"],
      comparable: false,
      filmScoreDelta: null,
      assertionChanges: [
        { id: "production/column-strength", from: "pass", to: "fail" },
      ],
    },
  );
  const changedTaskDigest = digestBenchmarkValue("changed-task-law");
  TestValidator.equals(
    "a diff across changed task law names the digest drift",
    diffAutoMovieBenchmarkVerdicts(productionVerdict, {
      ...legacyVerdict,
      taskDigest: changedTaskDigest,
    }).versionDrift,
    [`taskDigest: ${productionVerdict.taskDigest} -> ${changedTaskDigest}`],
  );
  const sameLaw = diffAutoMovieBenchmarkVerdicts(
    productionVerdict,
    legacyVerdict,
  );
  TestValidator.equals(
    "a diff under one law reports the moved assertions",
    {
      versionDrift: sameLaw.versionDrift,
      comparable: sameLaw.comparable,
      assertionChanges: sameLaw.assertionChanges,
    },
    {
      versionDrift: [],
      comparable: true,
      assertionChanges: [
        { id: "production/column-strength", from: "pass", to: "fail" },
      ],
    },
  );
  TestValidator.equals(
    "the comparable delta is the production axis the legacy run lost",
    sameLaw.filmScoreDelta?.toFixed(4),
    "-0.1000",
  );
  TestValidator.equals(
    "an unscored verdict settles nothing, so every assertion left",
    diffAutoMovieBenchmarkVerdicts(
      productionVerdict,
      excluded,
    ).assertionChanges.filter((change) => change.to === null).length,
    12,
  );
  TestValidator.equals(
    "read the other way around, the same twelve assertions arrive",
    diffAutoMovieBenchmarkVerdicts(
      excluded,
      productionVerdict,
    ).assertionChanges.filter((change) => change.from === null).length,
    12,
  );
};
